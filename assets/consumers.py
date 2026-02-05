import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ServerAsset

# 접속 중인 사용자 추적 (메모리에 저장)
connected_users = {}


class AssetSyncConsumer(AsyncWebsocketConsumer):
    """서버 자산 실시간 동기화 WebSocket Consumer"""

    async def connect(self):
        """WebSocket 연결"""
        self.room_group_name = 'asset_sync'
        self.user_id = None
        self.username = None

        # 그룹에 참가
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        """WebSocket 연결 해제"""
        # 사용자 목록에서 제거
        if self.channel_name in connected_users:
            del connected_users[self.channel_name]

        # 다른 사용자들에게 퇴장 알림
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_leave',
                'user_id': self.user_id,
                'username': self.username,
                'users': list(connected_users.values())
            }
        )

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """클라이언트로부터 메시지 수신"""
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'join':
                # 사용자 접속
                self.user_id = data.get('user_id')
                self.username = data.get('username')

                # 사용자 목록에 추가
                connected_users[self.channel_name] = {
                    'user_id': self.user_id,
                    'username': self.username,
                    'editing_cell': None
                }

                # 모든 사용자에게 접속자 목록 브로드캐스트
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_join',
                        'user_id': self.user_id,
                        'username': self.username,
                        'users': list(connected_users.values())
                    }
                )

            elif action == 'focus':
                # 셀 포커스 (편집 시작)
                asset_id = data.get('asset_id')
                field_name = data.get('field_name')

                if self.channel_name in connected_users:
                    connected_users[self.channel_name]['editing_cell'] = {
                        'asset_id': asset_id,
                        'field_name': field_name
                    }

                # 다른 사용자들에게 편집 위치 브로드캐스트
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_focus',
                        'user_id': self.user_id,
                        'username': self.username,
                        'asset_id': asset_id,
                        'field_name': field_name
                    }
                )

            elif action == 'blur':
                # 셀 포커스 해제
                if self.channel_name in connected_users:
                    connected_users[self.channel_name]['editing_cell'] = None

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_blur',
                        'user_id': self.user_id,
                        'username': self.username
                    }
                )

            elif action == 'update':
                # 자산 업데이트
                asset_id = data.get('asset_id')
                field_name = data.get('field_name')
                field_value = data.get('field_value')
                user_id = data.get('user_id')

                # 데이터베이스 업데이트
                success = await self.update_asset(asset_id, field_name, field_value, user_id)

                if success:
                    # 모든 클라이언트에 브로드캐스트
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'asset_update',
                            'asset_id': asset_id,
                            'field_name': field_name,
                            'field_value': field_value,
                            'user_id': user_id
                        }
                    )

            elif action == 'request_all':
                # 전체 데이터 요청
                assets_data = await self.get_all_assets()
                await self.send(text_data=json.dumps({
                    'type': 'all_assets',
                    'assets': assets_data
                }))

        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def user_join(self, event):
        """사용자 접속 알림"""
        await self.send(text_data=json.dumps({
            'type': 'user_join',
            'user_id': event['user_id'],
            'username': event['username'],
            'users': event['users']
        }))

    async def user_leave(self, event):
        """사용자 퇴장 알림"""
        await self.send(text_data=json.dumps({
            'type': 'user_leave',
            'user_id': event['user_id'],
            'username': event['username'],
            'users': event['users']
        }))

    async def user_focus(self, event):
        """사용자 셀 포커스 알림"""
        await self.send(text_data=json.dumps({
            'type': 'user_focus',
            'user_id': event['user_id'],
            'username': event['username'],
            'asset_id': event['asset_id'],
            'field_name': event['field_name']
        }))

    async def user_blur(self, event):
        """사용자 셀 포커스 해제 알림"""
        await self.send(text_data=json.dumps({
            'type': 'user_blur',
            'user_id': event['user_id'],
            'username': event['username']
        }))

    async def asset_update(self, event):
        """그룹으로부터 받은 자산 업데이트 메시지를 클라이언트에 전송"""
        await self.send(text_data=json.dumps({
            'type': 'update',
            'asset_id': event['asset_id'],
            'field_name': event['field_name'],
            'field_value': event['field_value'],
            'user_id': event['user_id']
        }))

    @database_sync_to_async
    def update_asset(self, asset_id, field_name, field_value, user_id):
        """데이터베이스에서 자산 업데이트"""
        try:
            asset = ServerAsset.objects.get(id=asset_id)

            # 사용자 정보 저장 (signal에서 사용)
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(id=user_id) if user_id else None
                asset._current_user = user
            except User.DoesNotExist:
                asset._current_user = None

            # 필드 업데이트
            if hasattr(asset, field_name):
                # Boolean 필드 처리
                if field_name == 'internet_facing':
                    field_value = field_value in ['true', 'True', '1', 1, True]
                # Integer 필드 처리
                elif field_name == 'importance_score':
                    field_value = int(field_value) if field_value else None

                setattr(asset, field_name, field_value)
                asset.save()
                return True
            return False
        except ServerAsset.DoesNotExist:
            return False
        except Exception as e:
            print(f"Error updating asset: {e}")
            return False

    @database_sync_to_async
    def get_all_assets(self):
        """모든 자산 데이터 가져오기"""
        assets = ServerAsset.objects.all().values()
        return list(assets)
