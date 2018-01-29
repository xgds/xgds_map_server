#__BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#__END_LICENSE__

from django.conf.urls import url  # pylint: disable=W0401
from django.conf import settings

from xgds_map_server import views

urlpatterns = [url(r'^treejson/', views.getFancyTreeJSON, {}, 'mapTreeJSON'),
               url(r'^selectedjson/', views.getSelectedNodesJSON, {}, 'mapSelectedJSON'),
               url(r'^uuidsjson/', views.getNodesByUuidJSON, {}, 'mapSelectedUUIDJSON'),
               url(r'^mapLayerJSON/(?P<layerID>[\w-]+)/', views.getMapLayerJSON, {}, 'mapLayerJSON'),
               url(r'^maplayer/kml/(?P<layerID>[\w-]+).kml', views.getMapLayerKML,{},'mapLayerKML'),
               url(r'^mapCollectionJSON/(?P<mapCollectionID>[\w-]+)/', views.getMapCollectionJSON, {}, 'mapCollectionJSON'),
               url(r'^mapSearchJSON/(?P<mapSearchID>[\w-]+)/', views.getMapSearchJSON, {}, 'mapSearchJSON'),
               url(r'^fmapJson/(?P<object_name>[\w]+[\.]*[\w]*)/(?P<filter>[\w]+:[\w]+)$', views.getMappedObjectsJson, {'isLive':settings.GEOCAM_UTIL_LIVE_MODE, 'force':True}, 'xgds_map_server_objectsJson_force'),
               url(r'^mapJson/(?P<object_name>[\w]+[\.]*[\w]*)/(?P<filter>[\w]+:[\w]+)$', views.getMappedObjectsJson, {'isLive':settings.GEOCAM_UTIL_LIVE_MODE}, 'xgds_map_server_objectsJson'),
               url(r'^mapJson/(?P<object_name>[\w]+[\.]*[\w]*)/(?P<range>[\d]+)$', views.getMappedObjectsJson, {'isLive':settings.GEOCAM_UTIL_LIVE_MODE}, 'xgds_map_server_objectsJson_range'),
               url(r'^mapJson/(?P<object_name>[\w]+[\.]*[\w]*)$', views.getMappedObjectsJson, {'range':0, 'force': True, 'isLive':settings.GEOCAM_UTIL_LIVE_MODE}, 'xgds_map_server_objectsJson_default'),
               url(r'^lastJson/(?P<object_name>[\w]+[\.]*[\w]*)/(?P<filter>[\w]+:[\w]+)$', views.getLastObjectJson, {},'xgds_map_server_lastJson_filter'),
               url(r'^lastJson/(?P<object_name>[\w]+[\.]*[\w]*)$', views.getLastObjectJson, {}, 'xgds_map_server_lastJson'),
    
               url(r'^view/(?P<mapName>\w+)/$', views.MapOrderListJson.as_view(), {}, 'map_view_json'),
               url(r'^view/(?P<mapName>\w+)/(?P<filter>(([\w]+|[a-zA-Z0-9:._\-\s]+),*)+)$', views.MapOrderListJson.as_view(), {}, 'map_view_json_filter'),

               url(r'^json/(?P<mapName>\w+)/(?P<currentPK>[\d]+)$', views.getObject, {}, 'xgds_map_server_object'),
               url(r'^lastJson2/(?P<mapName>\w+)/$', views.getLastObject, {}, 'xgds_map_server_lastJson2'),
               url(r'^prevJson/(?P<mapName>\w+)/(?P<currentPK>[\d]+)$', views.getPrevNextObject, {'which':'previous'}, 'xgds_map_server_prevJson'),
               url(r'^nextJson/(?P<mapName>\w+)/(?P<currentPK>[\d]+)$', views.getPrevNextObject, {'which':'next'}, 'xgds_map_server_nextJson'),
               url(r'^feed/(?P<feedname>.*)', views.getMapFeed,{},'xgds_map_server_feed'),

               url(r'^overlayTimeImage/(?P<overlayId>[\w-]+)/(?P<timeString>([\d]+-*)+T([\d]+:*)+Z*)$', views.getOverlayTimeImage, {}, 'overlayTimeImage'),
               url(r'^overlayTimeImage/(?P<overlayId>[\w-]+)$', views.getOverlayTimeImage, {}, 'overlayNoTimeImage'),
               url(r'^overlayTime/(?P<overlayId>[\w-]+)/(?P<timeString>([\d]+-*)+T([\d]+:*)+Z*)$', views.getOverlayTime, {}, 'overlayTime'),
               url(r'^overlayTime/(?P<overlayId>[\w-]+)$', views.getOverlayTime, {}, 'overlayNoTime'),

               ]
