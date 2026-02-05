import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'asset_management.settings')
django.setup()

import pandas as pd
from assets.models import ServerAsset
from django.contrib.auth.models import User

file_path = '자산관리대장_인프라운영팀.xlsx'

# 클라우드_다우오피스 시트 읽기 (헤더가 4번째 행, 0부터 시작하면 3)
df = pd.read_excel(file_path, sheet_name='클라우드_다우오피스', header=4)

print(f"컬럼명: {list(df.columns)}")
print(f"총 행 수: {len(df)}")

# 사용자 가져오기
admin_user = User.objects.get(username='admin')

created_count = 0
updated_count = 0
error_count = 0

for index, row in df.iterrows():
    try:
        # 서버코드 확인 (서버 코드 또는 비슷한 컬럼 찾기)
        server_code = None
        for col in df.columns:
            if '서버' in str(col) and '코드' in str(col):
                server_code = row[col]
                break

        if pd.isna(server_code) or str(server_code).strip() == '':
            continue

        server_code = str(server_code).strip()

        # 데이터 매핑
        asset_data = {}

        for col in df.columns:
            col_str = str(col).strip()
            val = row[col]

            # NaN 처리
            if pd.isna(val):
                val = ''
            else:
                val = str(val).strip()
                if val.lower() == 'nan':
                    val = ''

            # 컬럼 매핑
            if '서버' in col_str and '코드' in col_str:
                asset_data['server_code'] = val
            elif '자산' in col_str and ('명' in col_str or 'Host' in col_str):
                asset_data['asset_name'] = val
            elif col_str == '상태':
                asset_data['status'] = val
            elif col_str == 'ACG':
                asset_data['acg'] = val
            elif col_str == 'OS':
                asset_data['os'] = val
            elif '사설' in col_str and 'IP' in col_str:
                asset_data['private_ip'] = val
            elif '공인' in col_str and 'IP' in col_str:
                asset_data['public_ip'] = val
            elif 'VPN' in col_str and 'IP' in col_str:
                asset_data['vpn_ip'] = val
            elif '인터넷' in col_str and '접점' in col_str:
                asset_data['internet_facing'] = val.lower() in ['o', 'yes', 'true', '예', '운영']
            elif '서비스' in col_str and '대분류' in col_str:
                asset_data['service_category'] = val
            elif '서비스' in col_str and '소분류' in col_str:
                asset_data['service_subcategory'] = val
            elif '자산' in col_str and '위치' in col_str:
                asset_data['asset_location'] = val
            elif '세부' in col_str and '위치' in col_str:
                asset_data['detailed_location'] = val
            elif col_str == '스펙':
                asset_data['specs'] = val
            elif col_str == '담당자':
                asset_data['manager'] = val
            elif col_str == '관리자':
                asset_data['administrator'] = val
            elif '관리' in col_str and '부서' in col_str:
                asset_data['management_department'] = val
            elif col_str == '기밀성':
                asset_data['confidentiality'] = val
            elif col_str == '무결성':
                asset_data['integrity'] = val
            elif col_str == '가용성':
                asset_data['availability'] = val
            elif '중요도' in col_str and '점수' in col_str:
                try:
                    asset_data['importance_score'] = int(float(val)) if val else None
                except:
                    asset_data['importance_score'] = None
            elif '중요도' in col_str and '등급' in col_str:
                asset_data['importance_grade'] = val
            elif col_str == '비고':
                asset_data['notes'] = val
            elif '모델' in col_str and '버전' in col_str:
                asset_data['model_version'] = val

        if 'server_code' not in asset_data or not asset_data['server_code']:
            continue

        # 데이터베이스에 저장
        asset, created = ServerAsset.objects.update_or_create(
            server_code=asset_data['server_code'],
            defaults=asset_data
        )
        asset._current_user = admin_user
        asset.save()

        if created:
            created_count += 1
        else:
            updated_count += 1

    except Exception as e:
        error_count += 1
        print(f"Row {index} error: {e}")

print(f"\n완료: {created_count}개 생성, {updated_count}개 업데이트, {error_count}개 오류")
print(f"총 자산 수: {ServerAsset.objects.count()}")
