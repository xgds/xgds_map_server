# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.conf.urls.defaults import *

from xgds_map_server import settings
from xgds_map_server.views import *

urlpatterns = patterns(
    '',

    (r'^$', getMapListPage,
     {'readOnly': True},
     'xgds_map_server_index'),
    # Map server urls
    # HTML list of maps with description and links to individual maps, and a link to the kml feed
    (r'^list/', getMapListPage,
     {'readOnly': True},
     'mapList'),
    # This URL should receive a static files
    (r'^data/(?P<path>.*)$', 'django.views.static.serve',
     {'document_root' : settings.DATA_URL + settings.XGDS_MAP_SERVER_DATA_SUBDIR,
      'show_indexes' : True,
      'readOnly': True},
     'xgds_map_server_static'),
    # By default if you just load the app you should see the list
    (r'^feed/(?P<feedname>.*)', getMapFeed,
     {'readOnly': True,
      'challenge': settings.SECURITY_GOOGLE_EARTH_CHALLENGE},
     'xgds_map_server_feed'),
)
