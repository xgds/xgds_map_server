from django.conf.urls import patterns, include

urlpatterns = patterns(
    '',

    (r'^xgds_map_server/', include('xgds_map_server.urls')),
)
