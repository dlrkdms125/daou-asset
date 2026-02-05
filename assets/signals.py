from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from .models import ServerAsset, ChangeHistory


# 변경 전 데이터를 저장할 딕셔너리
_pre_save_instances = {}


@receiver(pre_save, sender=ServerAsset)
def capture_pre_save_data(sender, instance, **kwargs):
    """저장 전 기존 데이터를 캡처"""
    if instance.pk:
        try:
            old_instance = ServerAsset.objects.get(pk=instance.pk)
            _pre_save_instances[instance.pk] = old_instance
        except ServerAsset.DoesNotExist:
            pass


@receiver(post_save, sender=ServerAsset)
def track_asset_changes(sender, instance, created, **kwargs):
    """서버 자산 변경 이력 추적"""
    # 현재 요청에서 사용자 정보 가져오기 (middleware에서 설정됨)
    user = getattr(instance, '_current_user', None)

    if created:
        # 새로 생성된 경우
        ChangeHistory.objects.create(
            asset=instance,
            user=user,
            field_name='전체',
            old_value='',
            new_value='새 자산 생성',
            change_type='CREATE'
        )
    else:
        # 업데이트된 경우 - 변경된 필드 찾기
        old_instance = _pre_save_instances.get(instance.pk)
        if old_instance:
            # 추적할 필드 목록
            fields_to_track = [
                'status', 'server_code', 'asset_name', 'acg', 'os',
                'private_ip', 'public_ip', 'vpn_ip', 'internet_facing',
                'service_category', 'service_subcategory',
                'asset_location', 'detailed_location', 'specs',
                'manager', 'administrator', 'management_department',
                'confidentiality', 'integrity', 'availability',
                'importance_score', 'importance_grade', 'notes', 'model_version'
            ]

            for field_name in fields_to_track:
                old_value = getattr(old_instance, field_name, '')
                new_value = getattr(instance, field_name, '')

                # 값이 변경되었는지 확인
                if old_value != new_value:
                    ChangeHistory.objects.create(
                        asset=instance,
                        user=user,
                        field_name=instance._meta.get_field(field_name).verbose_name,
                        old_value=str(old_value) if old_value is not None else '',
                        new_value=str(new_value) if new_value is not None else '',
                        change_type='UPDATE'
                    )

            # 처리 완료 후 딕셔너리에서 제거
            del _pre_save_instances[instance.pk]


@receiver(post_delete, sender=ServerAsset)
def track_asset_deletion(sender, instance, **kwargs):
    """서버 자산 삭제 이력 추적"""
    user = getattr(instance, '_current_user', None)

    ChangeHistory.objects.create(
        asset=None,  # 이미 삭제되었으므로 None
        user=user,
        field_name='전체',
        old_value=f'{instance.server_code} - {instance.asset_name}',
        new_value='',
        change_type='DELETE'
    )
