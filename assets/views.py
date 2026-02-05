from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import Max, F
from django.utils import timezone
from datetime import timedelta
import pandas as pd
from .models import ServerAsset, ChangeHistory, CustomField, CustomFieldValue
from .forms import ExcelUploadForm, ServerAssetForm


def cleanup_old_change_history(days=14):
    """2주(14일) 이상 된 변경 이력 삭제"""
    cutoff_date = timezone.now() - timedelta(days=days)
    deleted_count, _ = ChangeHistory.objects.filter(changed_at__lt=cutoff_date).delete()
    return deleted_count


class AssetListView(LoginRequiredMixin, ListView):
    """서버 자산 목록 뷰"""
    model = ServerAsset
    template_name = 'assets/asset_list.html'
    context_object_name = 'assets'
    paginate_by = None  # 모든 자산 표시 (페이지네이션 비활성화)

    def get_queryset(self):
        queryset = super().get_queryset().order_by('display_order', 'id')
        search = self.request.GET.get('search')
        if search:
            queryset = queryset.filter(
                server_code__icontains=search
            ) | queryset.filter(
                asset_name__icontains=search
            )
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['user_id'] = self.request.user.id

        # 활성화된 사용자 정의 필드 가져오기
        custom_fields = CustomField.objects.filter(is_active=True)
        context['custom_fields'] = custom_fields

        # 각 자산에 대한 사용자 정의 필드 값 가져오기
        assets = context['assets']
        custom_values = {}
        for asset in assets:
            asset_values = {}
            field_values = CustomFieldValue.objects.filter(asset=asset).select_related('custom_field')
            for fv in field_values:
                asset_values[fv.custom_field.field_key] = fv.value
            custom_values[asset.id] = asset_values
        context['custom_values'] = custom_values

        return context


class AssetCreateView(LoginRequiredMixin, CreateView):
    """서버 자산 생성 뷰"""
    model = ServerAsset
    form_class = ServerAssetForm
    template_name = 'assets/asset_form.html'
    success_url = reverse_lazy('asset_list')

    def form_valid(self, form):
        asset = form.save(commit=False)
        asset._current_user = self.request.user
        asset.save()
        messages.success(self.request, '서버 자산이 생성되었습니다.')
        return super().form_valid(form)


class AssetUpdateView(LoginRequiredMixin, UpdateView):
    """서버 자산 수정 뷰"""
    model = ServerAsset
    form_class = ServerAssetForm
    template_name = 'assets/asset_form.html'
    success_url = reverse_lazy('asset_list')

    def form_valid(self, form):
        asset = form.save(commit=False)
        asset._current_user = self.request.user
        asset.save()
        messages.success(self.request, '서버 자산이 수정되었습니다.')
        return super().form_valid(form)


class AssetDeleteView(LoginRequiredMixin, DeleteView):
    """서버 자산 삭제 뷰"""
    model = ServerAsset
    success_url = reverse_lazy('asset_list')

    def delete(self, request, *args, **kwargs):
        self.object = self.get_object()
        self.object._current_user = request.user
        messages.success(request, '서버 자산이 삭제되었습니다.')
        return super().delete(request, *args, **kwargs)


@login_required
def excel_upload_view(request):
    """엑셀 파일 업로드 및 데이터 가져오기"""
    if request.method == 'POST':
        form = ExcelUploadForm(request.POST, request.FILES)
        if form.is_valid():
            excel_file = request.FILES['excel_file']

            try:
                # pandas로 엑셀 파일 읽기
                df = pd.read_excel(excel_file, engine='openpyxl')

                # 컬럼명 매핑 (한글 -> 모델 필드명)
                column_mapping = {
                    '상태': 'status',
                    '서버코드': 'server_code',
                    '서버 코드': 'server_code',
                    '자산명': 'asset_name',
                    'ACG': 'acg',
                    'OS': 'os',
                    '사설IP': 'private_ip',
                    '사설 IP': 'private_ip',
                    '공인IP': 'public_ip',
                    '공인 IP': 'public_ip',
                    'VPN IP': 'vpn_ip',
                    'VPN  IP': 'vpn_ip',
                    '인터넷접점여부': 'internet_facing',
                    '인터넷 접점여부': 'internet_facing',
                    '서비스대분류': 'service_category',
                    '서비스 대분류': 'service_category',
                    '서비스소분류': 'service_subcategory',
                    '서비스 소분류': 'service_subcategory',
                    '자산위치': 'asset_location',
                    '세부위치': 'detailed_location',
                    '스펙': 'specs',
                    '담당자': 'manager',
                    '관리자': 'administrator',
                    '관리부서': 'management_department',
                    '기밀성': 'confidentiality',
                    '무결성': 'integrity',
                    '가용성': 'availability',
                    '중요도점수': 'importance_score',
                    '중요도 점수': 'importance_score',
                    '중요도등급': 'importance_grade',
                    '중요도 등급': 'importance_grade',
                    '비고': 'notes',
                    '모델및버전': 'model_version',
                    '모델 및 버전': 'model_version',
                }

                # 컬럼명 변환
                df = df.rename(columns=column_mapping)

                created_count = 0
                updated_count = 0
                error_count = 0

                # 각 행을 처리
                for index, row in df.iterrows():
                    try:
                        if 'server_code' not in row or pd.isna(row['server_code']):
                            continue

                        # 데이터 준비
                        asset_data = {
                            'server_code': str(row.get('server_code', '')).strip(),
                            'asset_name': str(row.get('asset_name', '')).strip(),
                            'status': str(row.get('status', '')).strip(),
                            'acg': str(row.get('acg', '')).strip(),
                            'os': str(row.get('os', '')).strip(),
                            'private_ip': str(row.get('private_ip', '')).strip(),
                            'public_ip': str(row.get('public_ip', '')).strip(),
                            'vpn_ip': str(row.get('vpn_ip', '')).strip(),
                            'service_category': str(row.get('service_category', '')).strip(),
                            'service_subcategory': str(row.get('service_subcategory', '')).strip(),
                            'asset_location': str(row.get('asset_location', '')).strip(),
                            'detailed_location': str(row.get('detailed_location', '')).strip(),
                            'specs': str(row.get('specs', '')).strip(),
                            'manager': str(row.get('manager', '')).strip(),
                            'administrator': str(row.get('administrator', '')).strip(),
                            'management_department': str(row.get('management_department', '')).strip(),
                            'confidentiality': str(row.get('confidentiality', '')).strip(),
                            'integrity': str(row.get('integrity', '')).strip(),
                            'availability': str(row.get('availability', '')).strip(),
                            'importance_grade': str(row.get('importance_grade', '')).strip(),
                            'notes': str(row.get('notes', '')).strip(),
                            'model_version': str(row.get('model_version', '')).strip(),
                        }

                        # 인터넷 접점여부 처리
                        internet_facing = row.get('internet_facing', '')
                        if pd.notna(internet_facing):
                            internet_facing_str = str(internet_facing).strip().lower()
                            asset_data['internet_facing'] = internet_facing_str in ['o', 'x'] and internet_facing_str == 'x'

                        # 중요도 점수 처리
                        if 'importance_score' in row and pd.notna(row['importance_score']):
                            try:
                                asset_data['importance_score'] = int(float(row['importance_score']))
                            except (ValueError, TypeError):
                                asset_data['importance_score'] = None

                        # 'nan' 문자열을 빈 문자열로 변환
                        for key in asset_data:
                            if isinstance(asset_data[key], str) and asset_data[key].lower() == 'nan':
                                asset_data[key] = ''

                        # server_code로 기존 자산 찾기
                        asset, created = ServerAsset.objects.update_or_create(
                            server_code=asset_data['server_code'],
                            defaults=asset_data
                        )

                        # 사용자 정보 설정
                        asset._current_user = request.user
                        asset.save()

                        if created:
                            created_count += 1
                        else:
                            updated_count += 1

                    except Exception as e:
                        error_count += 1
                        print(f"Row {index} error: {e}")

                messages.success(
                    request,
                    f'엑셀 업로드 완료: {created_count}개 생성, {updated_count}개 업데이트, {error_count}개 오류'
                )
                return redirect('asset_list')

            except Exception as e:
                messages.error(request, f'엑셀 파일 처리 중 오류가 발생했습니다: {str(e)}')

    else:
        form = ExcelUploadForm()

    return render(request, 'assets/excel_upload.html', {'form': form})


@login_required
def change_history_view(request):
    """변경 이력 조회 뷰"""
    from django.db.models import Q

    # 2주 이상 된 변경 이력 자동 삭제
    deleted_count = cleanup_old_change_history(days=14)
    if deleted_count > 0:
        print(f"[자동 정리] {deleted_count}개의 오래된 변경 이력 삭제됨")

    # 검색어
    search = request.GET.get('search', '').strip()

    histories = ChangeHistory.objects.select_related('asset', 'user').all()

    # 검색 필터 적용
    if search:
        histories = histories.filter(
            Q(asset__server_code__icontains=search) |
            Q(asset__asset_name__icontains=search) |
            Q(user__username__icontains=search)
        )

    # 최근 500개만 표시
    histories = histories[:500]

    context = {
        'histories': histories,
        'search': search
    }

    return render(request, 'assets/change_history.html', context)


@login_required
def asset_detail_json(request, pk):
    """자산 상세 정보 JSON 응답"""
    asset = get_object_or_404(ServerAsset, pk=pk)
    data = {
        'id': asset.id,
        'server_code': asset.server_code,
        'asset_name': asset.asset_name,
        'status': asset.status,
        'acg': asset.acg,
        'os': asset.os,
        'private_ip': asset.private_ip,
        'public_ip': asset.public_ip,
        'vpn_ip': asset.vpn_ip,
        'internet_facing': asset.internet_facing,
        'service_category': asset.service_category,
        'service_subcategory': asset.service_subcategory,
        'asset_location': asset.asset_location,
        'detailed_location': asset.detailed_location,
        'specs': asset.specs,
        'manager': asset.manager,
        'administrator': asset.administrator,
        'management_department': asset.management_department,
        'confidentiality': asset.confidentiality,
        'integrity': asset.integrity,
        'availability': asset.availability,
        'importance_score': asset.importance_score,
        'importance_grade': asset.importance_grade,
        'notes': asset.notes,
        'model_version': asset.model_version,
        'last_modified_date': asset.last_modified_date.isoformat() if asset.last_modified_date else None,
    }
    return JsonResponse(data)


@login_required
def custom_field_list_view(request):
    """사용자 정의 필드 관리 뷰"""
    custom_fields = CustomField.objects.all()
    return render(request, 'assets/custom_field_list.html', {'custom_fields': custom_fields})


@login_required
def custom_field_create_view(request):
    """사용자 정의 필드 생성"""
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        field_type = request.POST.get('field_type', 'text')
        options = request.POST.get('options', '').strip()
        is_required = request.POST.get('is_required') == 'on'

        if name:
            # field_key 생성 (영문/숫자로 변환)
            import re
            field_key = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
            field_key = f"custom_{field_key}"

            # 중복 체크
            base_key = field_key
            counter = 1
            while CustomField.objects.filter(field_key=field_key).exists():
                field_key = f"{base_key}_{counter}"
                counter += 1

            # 표시 순서 계산
            max_order = CustomField.objects.aggregate(Max('display_order'))['display_order__max'] or 0

            custom_field = CustomField.objects.create(
                name=name,
                field_key=field_key,
                field_type=field_type,
                options=options,
                is_required=is_required,
                display_order=max_order + 1
            )

            # 변경 이력 기록
            ChangeHistory.objects.create(
                asset=None,
                user=request.user,
                field_name=f"[컬럼 추가] {name}",
                old_value='',
                new_value=f"타입: {custom_field.get_field_type_display()}",
                change_type='CREATE'
            )

            messages.success(request, f'사용자 정의 필드 "{name}"이(가) 생성되었습니다.')
        else:
            messages.error(request, '필드명을 입력해주세요.')

        return redirect('custom_field_list')

    return render(request, 'assets/custom_field_form.html', {'mode': 'create'})


@login_required
def custom_field_edit_view(request, pk):
    """사용자 정의 필드 수정"""
    custom_field = get_object_or_404(CustomField, pk=pk)

    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        field_type = request.POST.get('field_type', 'text')
        options = request.POST.get('options', '').strip()
        is_required = request.POST.get('is_required') == 'on'
        is_active = request.POST.get('is_active') == 'on'

        if name:
            custom_field.name = name
            custom_field.field_type = field_type
            custom_field.options = options
            custom_field.is_required = is_required
            custom_field.is_active = is_active
            custom_field.save()
            messages.success(request, f'사용자 정의 필드 "{name}"이(가) 수정되었습니다.')
        else:
            messages.error(request, '필드명을 입력해주세요.')

        return redirect('custom_field_list')

    return render(request, 'assets/custom_field_form.html', {
        'mode': 'edit',
        'custom_field': custom_field
    })


@login_required
def custom_field_delete_view(request, pk):
    """사용자 정의 필드 삭제"""
    custom_field = get_object_or_404(CustomField, pk=pk)

    if request.method == 'POST':
        name = custom_field.name
        field_type_display = custom_field.get_field_type_display()

        # 변경 이력 기록 (삭제 전에 기록)
        ChangeHistory.objects.create(
            asset=None,
            user=request.user,
            field_name=f"[컬럼 삭제] {name}",
            old_value=f"타입: {field_type_display}",
            new_value='',
            change_type='DELETE'
        )

        custom_field.delete()
        messages.success(request, f'사용자 정의 필드 "{name}"이(가) 삭제되었습니다.')
        return redirect('custom_field_list')

    return render(request, 'assets/custom_field_confirm_delete.html', {'custom_field': custom_field})


@login_required
def custom_field_reorder_view(request):
    """사용자 정의 필드 순서 변경 (AJAX)"""
    if request.method == 'POST':
        import json
        try:
            data = json.loads(request.body)
            order = data.get('order', [])

            for index, field_id in enumerate(order):
                CustomField.objects.filter(pk=field_id).update(display_order=index)

            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'POST method required'})


@login_required
def update_custom_field_value(request):
    """사용자 정의 필드 값 업데이트 (AJAX)"""
    if request.method == 'POST':
        import json
        try:
            data = json.loads(request.body)
            asset_id = data.get('asset_id')
            field_key = data.get('field_key')
            value = data.get('value', '')

            asset = get_object_or_404(ServerAsset, pk=asset_id)
            custom_field = get_object_or_404(CustomField, field_key=field_key)

            # 값 저장 또는 업데이트
            field_value, created = CustomFieldValue.objects.update_or_create(
                asset=asset,
                custom_field=custom_field,
                defaults={'value': value}
            )

            # 변경 이력 기록
            ChangeHistory.objects.create(
                asset=asset,
                user=request.user,
                field_name=f"[사용자정의] {custom_field.name}",
                old_value='' if created else field_value.value,
                new_value=value,
                change_type='UPDATE'
            )

            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'POST method required'})


@login_required
def reorder_assets_view(request):
    """자산(행) 순서 변경 (AJAX)"""
    if request.method == 'POST':
        import json
        try:
            data = json.loads(request.body)
            order = data.get('order', [])  # asset_id 배열
            moved_asset_id = data.get('moved_asset_id')
            moved_asset_name = data.get('moved_asset_name', '')
            old_position = data.get('old_position', 0)
            new_position = data.get('new_position', 0)

            for index, asset_id in enumerate(order):
                ServerAsset.objects.filter(pk=asset_id).update(display_order=index)

            # 변경 이력 기록
            if moved_asset_id:
                asset = ServerAsset.objects.filter(pk=moved_asset_id).first()
                ChangeHistory.objects.create(
                    asset=asset,
                    user=request.user,
                    field_name='[행 순서 변경]',
                    old_value=f'{old_position + 1}번째',
                    new_value=f'{new_position + 1}번째',
                    change_type='UPDATE'
                )

            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'POST method required'})


@login_required
def record_column_order_change(request):
    """컬럼 순서 변경 이력 기록 (AJAX)"""
    if request.method == 'POST':
        import json
        try:
            data = json.loads(request.body)
            column_name = data.get('column_name', '')
            old_position = data.get('old_position', 0)
            new_position = data.get('new_position', 0)

            ChangeHistory.objects.create(
                asset=None,
                user=request.user,
                field_name=f'[컬럼 순서 변경] {column_name}',
                old_value=f'{old_position + 1}번째',
                new_value=f'{new_position + 1}번째',
                change_type='UPDATE'
            )

            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'POST method required'})


@login_required
def copy_asset_view(request):
    """자산(행) 복사 - 새 행 생성 (AJAX)"""
    if request.method == 'POST':
        import json
        try:
            data = json.loads(request.body)
            source_asset_id = data.get('source_asset_id')
            insert_after_asset_id = data.get('insert_after_asset_id')
            row_data = data.get('row_data', {})

            # 원본 자산 가져오기
            source_asset = ServerAsset.objects.get(pk=source_asset_id)

            # 삽입 위치 이후의 자산들 display_order 일괄 증가
            if insert_after_asset_id:
                try:
                    ref_asset = ServerAsset.objects.get(pk=insert_after_asset_id)
                    ref_order = ref_asset.display_order
                except ServerAsset.DoesNotExist:
                    ref_order = ServerAsset.objects.aggregate(Max('display_order'))['display_order__max'] or 0
                ServerAsset.objects.filter(display_order__gt=ref_order).update(display_order=F('display_order') + 1)
                new_display_order = ref_order + 1
            else:
                max_order = ServerAsset.objects.aggregate(Max('display_order'))['display_order__max'] or 0
                new_display_order = max_order + 1

            # 고유한 서버코드 생성
            import time
            base_code = source_asset.server_code.replace('_복사', '').split('_')[0]  # 원본 코드 추출
            timestamp = int(time.time() * 1000) % 100000  # 짧은 타임스탬프
            new_server_code = f"{base_code}_복사_{timestamp}"

            # 중복 체크 및 재생성
            while ServerAsset.objects.filter(server_code=new_server_code).exists():
                timestamp += 1
                new_server_code = f"{base_code}_복사_{timestamp}"

            # 새 자산 생성 (원본 복사)
            new_asset = ServerAsset(
                status=row_data.get('status', {}).get('value', source_asset.status),
                server_code=new_server_code,
                asset_name=row_data.get('asset_name', {}).get('value', source_asset.asset_name),
                acg=row_data.get('acg', {}).get('value', source_asset.acg),
                os=row_data.get('os', {}).get('value', source_asset.os),
                private_ip=row_data.get('private_ip', {}).get('value', source_asset.private_ip),
                public_ip=row_data.get('public_ip', {}).get('value', source_asset.public_ip),
                vpn_ip=row_data.get('vpn_ip', {}).get('value', source_asset.vpn_ip),
                internet_facing=source_asset.internet_facing,
                service_category=row_data.get('service_category', {}).get('value', source_asset.service_category),
                service_subcategory=row_data.get('service_subcategory', {}).get('value', source_asset.service_subcategory),
                asset_location=row_data.get('asset_location', {}).get('value', source_asset.asset_location),
                detailed_location=row_data.get('detailed_location', {}).get('value', source_asset.detailed_location),
                specs=row_data.get('specs', {}).get('value', source_asset.specs),
                manager=row_data.get('manager', {}).get('value', source_asset.manager),
                administrator=row_data.get('administrator', {}).get('value', source_asset.administrator),
                management_department=row_data.get('management_department', {}).get('value', source_asset.management_department),
                confidentiality=row_data.get('confidentiality', {}).get('value', source_asset.confidentiality),
                integrity=row_data.get('integrity', {}).get('value', source_asset.integrity),
                availability=row_data.get('availability', {}).get('value', source_asset.availability),
                importance_score=source_asset.importance_score,
                importance_grade=row_data.get('importance_grade', {}).get('value', source_asset.importance_grade),
                notes=row_data.get('notes', {}).get('value', source_asset.notes),
                model_version=row_data.get('model_version', {}).get('value', source_asset.model_version),
                display_order=new_display_order
            )
            new_asset.save()

            # 사용자 정의 필드 값도 복사
            from .models import CustomField, CustomFieldValue
            custom_field_values = CustomFieldValue.objects.filter(asset=source_asset)
            for cfv in custom_field_values:
                CustomFieldValue.objects.create(
                    asset=new_asset,
                    custom_field=cfv.custom_field,
                    value=cfv.value
                )

            # 변경 이력 기록
            ChangeHistory.objects.create(
                asset=new_asset,
                user=request.user,
                field_name='[행 복사]',
                old_value=f'원본: {source_asset.server_code}',
                new_value=f'복사본: {new_asset.server_code}',
                change_type='CREATE'
            )

            return JsonResponse({
                'success': True,
                'new_asset_id': new_asset.id,
                'server_code': new_asset.server_code
            })
        except ServerAsset.DoesNotExist:
            return JsonResponse({'success': False, 'error': '원본 자산을 찾을 수 없습니다.'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'POST method required'})


@login_required
def create_empty_asset_view(request):
    """빈 자산(행) 생성 (AJAX)"""
    if request.method == 'POST':
        import json
        import time
        try:
            data = json.loads(request.body)
            insert_after_asset_id = data.get('insert_after_asset_id')

            # 삽입 위치 이후의 자산들 display_order 일괄 증가
            if insert_after_asset_id:
                try:
                    ref_asset = ServerAsset.objects.get(pk=insert_after_asset_id)
                    ref_order = ref_asset.display_order
                except ServerAsset.DoesNotExist:
                    ref_order = ServerAsset.objects.aggregate(Max('display_order'))['display_order__max'] or 0
                ServerAsset.objects.filter(display_order__gt=ref_order).update(display_order=F('display_order') + 1)
                new_display_order = ref_order + 1
            else:
                max_order = ServerAsset.objects.aggregate(Max('display_order'))['display_order__max'] or 0
                new_display_order = max_order + 1

            # 고유한 서버코드 생성
            timestamp = int(time.time() * 1000) % 100000
            new_server_code = f"NEW_{timestamp}"

            while ServerAsset.objects.filter(server_code=new_server_code).exists():
                timestamp += 1
                new_server_code = f"NEW_{timestamp}"

            # 빈 자산 생성
            new_asset = ServerAsset(
                server_code=new_server_code,
                asset_name='',
                status='',
                internet_facing=None,
                display_order=new_display_order
            )
            new_asset.save()

            # 변경 이력 기록
            ChangeHistory.objects.create(
                asset=new_asset,
                user=request.user,
                field_name='[행 생성]',
                old_value='',
                new_value=f'새 행: {new_asset.server_code}',
                change_type='CREATE'
            )

            return JsonResponse({
                'success': True,
                'new_asset_id': new_asset.id,
                'server_code': new_asset.server_code
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'POST method required'})


@login_required
def delete_asset_view(request):
    """자산(행) 삭제 (AJAX)"""
    if request.method == 'POST':
        import json
        try:
            data = json.loads(request.body)
            asset_id = data.get('asset_id')

            asset = ServerAsset.objects.get(pk=asset_id)
            server_code = asset.server_code
            asset_name = asset.asset_name

            asset.delete()

            # 변경 이력 기록 (asset=None, 이미 삭제됨)
            ChangeHistory.objects.create(
                asset=None,
                user=request.user,
                field_name='[행 삭제]',
                old_value=f'{server_code} - {asset_name}',
                new_value='',
                change_type='DELETE'
            )

            return JsonResponse({'success': True})
        except ServerAsset.DoesNotExist:
            return JsonResponse({'success': False, 'error': '자산을 찾을 수 없습니다.'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'POST method required'})
