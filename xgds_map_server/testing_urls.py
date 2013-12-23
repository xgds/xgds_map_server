from django.conf.urls import url, patterns, include

urlpatterns = patterns(
    '',

    (r'^xgds_map_server/', include('xgds_map_server.urls')),
)
