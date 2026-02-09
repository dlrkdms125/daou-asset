from django.db import models
from django.contrib.auth.models import User


class ServerAsset(models.Model):
    """서버 자산 모델"""

    # 기본 정보
    server_code = models.CharField('서버코드', max_length=100, blank=True)
    asset_name = models.CharField('자산명', max_length=200)
    status = models.CharField('상태', max_length=50, blank=True)

    # 네트워크 정보
    acg = models.CharField('ACG', max_length=100, blank=True)
    os = models.CharField('OS', max_length=100, blank=True)
    private_ip = models.CharField('사설IP', max_length=50, blank=True)
    public_ip = models.CharField('공인IP', max_length=50, blank=True)
    vpn_ip = models.CharField('VPN IP', max_length=50, blank=True)
    internet_facing = models.BooleanField('인터넷 접점여부', default=False, null=True, blank=True)

    # 서비스 정보
    service_category = models.CharField('서비스 대분류', max_length=100, blank=True)
    service_subcategory = models.CharField('서비스 소분류', max_length=100, blank=True)

    # 위치 정보
    asset_location = models.CharField('자산위치', max_length=200, blank=True)
    detailed_location = models.CharField('세부위치', max_length=200, blank=True)

    # 스펙 및 관리 정보
    specs = models.TextField('스펙', blank=True)
    manager = models.CharField('담당자', max_length=100, blank=True)
    administrator = models.CharField('관리자', max_length=100, blank=True)
    management_department = models.CharField('관리부서', max_length=100, blank=True)

    # 보안 등급
    confidentiality = models.CharField('기밀성', max_length=50, blank=True)
    integrity = models.CharField('무결성', max_length=50, blank=True)
    availability = models.CharField('가용성', max_length=50, blank=True)
    importance_score = models.IntegerField('중요도 점수', null=True, blank=True)
    importance_grade = models.CharField('중요도 등급', max_length=50, blank=True)

    # 기타
    notes = models.TextField('비고', blank=True)
    model_version = models.CharField('모델 및 버전', max_length=200, blank=True)

    # 메타 정보
    last_modified_date = models.DateTimeField('최종 수정일자', auto_now=True)
    created_at = models.DateTimeField('생성일시', auto_now_add=True)
    updated_at = models.DateTimeField('수정일시', auto_now=True)
    display_order = models.IntegerField('표시 순서', default=0, db_index=True)

    class Meta:
        db_table = 'server_assets'
        verbose_name = '서버 자산'
        verbose_name_plural = '서버 자산 목록'
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.server_code} - {self.asset_name}"


class ChangeHistory(models.Model):
    """변경 이력 모델"""

    CHANGE_TYPE_CHOICES = [
        ('CREATE', '생성'),
        ('UPDATE', '수정'),
        ('DELETE', '삭제'),
    ]

    asset = models.ForeignKey(
        ServerAsset,
        on_delete=models.CASCADE,
        related_name='change_histories',
        verbose_name='서버 자산',
        null=True,
        blank=True
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='변경 사용자'
    )
    changed_at = models.DateTimeField('변경 일시', auto_now_add=True)
    field_name = models.CharField('변경 필드', max_length=100)
    old_value = models.TextField('이전 값', blank=True)
    new_value = models.TextField('새로운 값', blank=True)
    change_type = models.CharField('변경 타입', max_length=10, choices=CHANGE_TYPE_CHOICES)

    class Meta:
        db_table = 'change_history'
        verbose_name = '변경 이력'
        verbose_name_plural = '변경 이력 목록'
        ordering = ['-changed_at']

    def __str__(self):
        if self.asset:
            return f"{self.asset.server_code} - {self.field_name} ({self.changed_at.strftime('%Y-%m-%d %H:%M')})"
        return f"[시스템] {self.field_name} ({self.changed_at.strftime('%Y-%m-%d %H:%M')})"


class CustomField(models.Model):
    """사용자 정의 필드 모델"""

    FIELD_TYPE_CHOICES = [
        ('text', '텍스트'),
        ('number', '숫자'),
        ('date', '날짜'),
        ('boolean', '예/아니오'),
        ('select', '선택 목록'),
    ]

    name = models.CharField('필드명', max_length=100)
    field_key = models.CharField('필드 키', max_length=100, unique=True)
    field_type = models.CharField('필드 타입', max_length=20, choices=FIELD_TYPE_CHOICES, default='text')
    is_required = models.BooleanField('필수 여부', default=False)
    display_order = models.IntegerField('표시 순서', default=0)
    options = models.TextField('선택 옵션', blank=True, help_text='선택 목록 타입일 경우, 쉼표로 구분하여 입력')
    is_active = models.BooleanField('활성화', default=True)
    created_at = models.DateTimeField('생성일시', auto_now_add=True)
    updated_at = models.DateTimeField('수정일시', auto_now=True)

    class Meta:
        db_table = 'custom_fields'
        verbose_name = '사용자 정의 필드'
        verbose_name_plural = '사용자 정의 필드 목록'
        ordering = ['display_order', 'created_at']

    def __str__(self):
        return f"{self.name} ({self.get_field_type_display()})"

    def get_options_list(self):
        """선택 옵션을 리스트로 반환"""
        if self.options:
            return [opt.strip() for opt in self.options.split(',') if opt.strip()]
        return []


class CustomFieldValue(models.Model):
    """사용자 정의 필드 값 모델"""

    asset = models.ForeignKey(
        ServerAsset,
        on_delete=models.CASCADE,
        related_name='custom_field_values',
        verbose_name='서버 자산'
    )
    custom_field = models.ForeignKey(
        CustomField,
        on_delete=models.CASCADE,
        related_name='values',
        verbose_name='사용자 정의 필드'
    )
    value = models.TextField('값', blank=True)
    updated_at = models.DateTimeField('수정일시', auto_now=True)

    class Meta:
        db_table = 'custom_field_values'
        verbose_name = '사용자 정의 필드 값'
        verbose_name_plural = '사용자 정의 필드 값 목록'
        unique_together = ['asset', 'custom_field']

    def __str__(self):
        return f"{self.asset.server_code} - {self.custom_field.name}: {self.value}"
