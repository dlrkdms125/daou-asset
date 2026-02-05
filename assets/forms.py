from django import forms
from .models import ServerAsset


class ExcelUploadForm(forms.Form):
    """엑셀 파일 업로드 폼"""
    excel_file = forms.FileField(
        label='엑셀 파일',
        help_text='xlsx 또는 xls 파일을 선택하세요',
        widget=forms.FileInput(attrs={'accept': '.xlsx,.xls'})
    )

    def clean_excel_file(self):
        file = self.cleaned_data.get('excel_file')
        if file:
            if not file.name.endswith(('.xlsx', '.xls')):
                raise forms.ValidationError('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.')
            if file.size > 10 * 1024 * 1024:  # 10MB
                raise forms.ValidationError('파일 크기는 10MB를 초과할 수 없습니다.')
        return file


class ServerAssetForm(forms.ModelForm):
    """서버 자산 편집 폼"""

    class Meta:
        model = ServerAsset
        fields = [
            'server_code', 'asset_name', 'status',
            'acg', 'os', 'private_ip', 'public_ip', 'vpn_ip', 'internet_facing',
            'service_category', 'service_subcategory',
            'asset_location', 'detailed_location', 'specs',
            'manager', 'administrator', 'management_department',
            'confidentiality', 'integrity', 'availability',
            'importance_score', 'importance_grade', 'notes', 'model_version'
        ]
        widgets = {
            'specs': forms.Textarea(attrs={'rows': 3}),
            'notes': forms.Textarea(attrs={'rows': 3}),
            'internet_facing': forms.CheckboxInput(),
        }
