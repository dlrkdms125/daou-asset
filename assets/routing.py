from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/assets/$', consumers.AssetSyncConsumer.as_asgi()),
]
