from django.urls import path
from . import views

urlpatterns = [
    path('', views.AssetListView.as_view(), name='asset_list'),
    path('create/', views.AssetCreateView.as_view(), name='asset_create'),
    path('<int:pk>/update/', views.AssetUpdateView.as_view(), name='asset_update'),
    path('<int:pk>/delete/', views.AssetDeleteView.as_view(), name='asset_delete'),
    path('<int:pk>/json/', views.asset_detail_json, name='asset_detail_json'),
    path('excel-upload/', views.excel_upload_view, name='excel_upload'),
    path('history/', views.change_history_view, name='change_history'),

    # 사용자 정의 필드 관리
    path('custom-fields/', views.custom_field_list_view, name='custom_field_list'),
    path('custom-fields/create/', views.custom_field_create_view, name='custom_field_create'),
    path('custom-fields/<int:pk>/edit/', views.custom_field_edit_view, name='custom_field_edit'),
    path('custom-fields/<int:pk>/delete/', views.custom_field_delete_view, name='custom_field_delete'),
    path('custom-fields/reorder/', views.custom_field_reorder_view, name='custom_field_reorder'),
    path('custom-field-value/update/', views.update_custom_field_value, name='update_custom_field_value'),

    # 순서 변경 및 이력 기록
    path('reorder-assets/', views.reorder_assets_view, name='reorder_assets'),
    path('record-column-order/', views.record_column_order_change, name='record_column_order'),
    path('copy-asset/', views.copy_asset_view, name='copy_asset'),
    path('create-empty-asset/', views.create_empty_asset_view, name='create_empty_asset'),
    path('delete-asset/', views.delete_asset_view, name='delete_asset'),
]
