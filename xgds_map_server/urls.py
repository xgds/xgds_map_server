# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.conf.urls.defaults import *

from xgds_map_server import settings
from xgds_map_server.views import *

urlpatterns = patterns('',
    # Map server urls
    # HTML list of maps with description and links to individual maps, and a link to the kml feed
    (r'^mapserver/list/', getMapListPage),
    # This URL should retrieve a top-level KML file with network link to the top-level feed
    #(r'^xgdsPlrp/mapserver/feed', getMapFeed,{'feedname':''}),
    # This URL should receive a static files
    (r'^data/mapserver/(?P<path>.*)$', 'django.views.static.serve',
     {'document_root' : settings.MAPSERVER_FILE_ROOT,
      'show_indexes' : True}),
    # By default if you just load the app you should see the list
    (r'^mapserver/feed/(?P<feedname>.*)', getMapFeed),
    (r'^mapserver', getMapListPage),
)
