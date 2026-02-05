import pandas as pd

file_path = '자산관리대장_인프라운영팀.xlsx'

# 모든 시트 확인
excel = pd.ExcelFile(file_path)
print("시트 목록:", excel.sheet_names)

# 각 시트의 내용 확인
for sheet in excel.sheet_names:
    print(f"\n{'='*50}")
    print(f"시트: {sheet}")
    print('='*50)
    df = pd.read_excel(file_path, sheet_name=sheet, header=None, nrows=10)
    print(f"행 수: {len(pd.read_excel(file_path, sheet_name=sheet))}")
    for i in range(min(10, len(df))):
        row = df.iloc[i, :10].tolist()
        if any(pd.notna(v) for v in row):
            print(f"Row {i}: {row}")
