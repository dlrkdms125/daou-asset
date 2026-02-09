from django.apps import AppConfig


class AssetsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'assets'

    def ready(self):
        import assets.signals
        from django.db.backends.signals import connection_created
        connection_created.connect(self._set_sqlite_pragmas)

    @staticmethod
    def _set_sqlite_pragmas(sender, connection, **kwargs):
        if connection.vendor == 'sqlite':
            cursor = connection.cursor()
            cursor.execute('PRAGMA journal_mode=WAL;')
            cursor.execute('PRAGMA synchronous=NORMAL;')
            cursor.execute('PRAGMA cache_size=-64000;')    # 64MB 캐시
            cursor.execute('PRAGMA temp_store=MEMORY;')     # 임시 테이블을 메모리에
            cursor.execute('PRAGMA mmap_size=268435456;')   # 256MB 메모리 매핑
            cursor.execute('PRAGMA busy_timeout=5000;')     # 5초 락 대기
