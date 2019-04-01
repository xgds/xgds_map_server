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

from django.conf.urls import url, include  # pylint: disable=W0401

from django.conf import settings
from resumable.views import ResumableUploadView

from xgds_map_server import views

urlpatterns = [url(r'^$', views.getMapServerIndexPage,{},'xgds_map_server_index'),
               url(r'^$', views.getMapServerIndexPage,{},'map'),
               url(r'^feedPage/', views.getGoogleEarthFeedPage,{},'xgds_map_server_feed_page'),
    
               # For copying feature data to the session variables
               url(r'^copyFeatures$', views.copyFeatures, {}, 'copyFeatures'),
    
               # for saving map layer itself
               url(r'^saveMaplayer.json$', views.saveMaplayer, {}, 'saveMaplayer'),
    
               # HTML tree of maps
               url(r'^maptree/', views.getMapTreePage, {},'mapTree'),
               url(r'^setTransparency/(?P<uuid>[\w-]+)/(?P<mapType>\w+)/(?P<value>[\d]+)', views.setTransparency, {}, 'mapSetTransparency'),
    
               # Open Map Editor on a map layer
               url(r'^mapeditor/(?P<layerID>[\w-]+)/', views.getMapEditorPage, {}, 'mapEditLayer'),

               # HTML detail view of map
               url(r'^detail/(?P<mapID>[\w-]+)/', views.getMapDetailPage,{},'mapDetail'),
    
               # HTML detail of a folder (group)
               url(r'^folderDetail/(?P<groupID>[\w-]+)/', views.getFolderDetailPage, {}, 'folderDetail'),
    
               # HTML view to delete a folder (group)
               url(r'^folderDelete/(?P<groupID>[\w-]+)/', views.getDeleteFolderPage, {}, 'folderDelete'),
    
               # HTML view to add a folder (group)
               url(r'^folderAdd/', views.getAddFolderPage, {}, 'folderAdd'),
    
               # HTML view to add new map
               url(r'^addkml/', views.getAddKmlPage, {}, 'addKml'),
               url(r'^addlayer/', views.getAddLayerPage, {}, 'mapAddLayer'),
               url(r'^addGeoJSON/', views.getAddGeoJSONPage, {}, 'mapAddGeoJSON'),
               url(r'^addGeotiff/', views.getAddGeotiffPage, {}, 'mapAddGeotiff'),
               url(r'^addLayerFromSelected/', views.addLayerFromSelected, {}, 'addLayerFromSelected'),
               url(r'^addTile/', views.getAddTilePage, {}, 'mapAddTile'),
               url(r'^editTile/(?P<tileID>[\w-]+)/', views.getEditTilePage, {}, 'mapEditTile'),
               url(r'^addMapDataTile/', views.getAddMapDataTilePage, {}, 'mapAddDataTile'),
               url(r'^editMapDataTile/(?P<tileID>[\w-]+)/', views.getEditMapDataTilePage, {}, 'mapEditDataTile'),
               url(r'^addWMS/', views.getAddWMSTilePage, {}, 'mapAddWMSTile'),
               url(r'^editWMS/(?P<tileID>[\w-]+)/', views.getEditWMSTilePage, {}, 'mapEditWMSTile'),

               # TODO all of the below urls depended on xgds_data and need to be reimplemented
               # url(r'^addMapSearch/', views.getAddMapSearchPage, {}, 'mapAddMapSearch'),
               # url(r'^editMapSearch/(?P<mapSearchID>[\w-]+)/', views.getEditMapSearchPage, {}, 'mapEditMapSearch'),
               # url(r'^addMapCollection/', views.getAddMapCollectionPage, {}, 'mapAddMapCollection'),
               # url(r'^editMapCollection/(?P<mapCollectionID>[\w-]+)/', views.getEditMapCollectionPage, {}, 'mapEditMapCollection'),
               # url(r'^doMapSearch/', views.searchWithinMap, {}, 'doMapSearch'),
               # url(r'^saveMapSearch/', views.saveSearchWithinMap, {}, 'saveMapSearch'),

               # HTML view to confirm deletion of view
               url(r'^delete/(?P<nodeID>[\w-]+)/', views.getDeleteNodePage, {}, 'nodeDelete'),
    
               # List of deleted maps that can be un-deleted
               url(r'^deleted/', views.getDeletedNodesPage, {}, 'deletedNodes'),
               
               # JSON-accepting url that moves maps/folders around
               url(r'^moveNode', views.moveNode, {}, 'moveNode'),
               
               # JSON-accepting url that changes visibility for a node
               url(r'^setNodeVisibility', views.setNodeVisibility, {}, 'setNodeVisibility'),

               # By default if you just load the app you should see the list
               url(r'^uploadResumable/$', ResumableUploadView.as_view(), name='uploadResumable'),
               
               url(r'^search/$', views.getSearchPage, {}, 'search_map'),
               url(r'^search/(?P<modelName>[\w]+)$', views.getSearchPage, {}, 'search_map_object'),
               url(r'^search/(?P<modelName>\w+)/(?P<filter>(([\w]+|[a-zA-Z0-9:._\-\s]+),*)+)$', views.getSearchPage, {}, 'search_map_object_filter'),
               url(r'^view/(?P<modelName>[\w]+)/(?P<modelPK>[\d]+)$', views.getViewSingleModelPage, {}, 'search_map_single_object'),
               #url(r'^view/(?P<modelName>[\w]+)/(?P<modelPK>[\d]+)$', views.getViewMultiModelPage, {}, 'search_map_single_object'),

               # replay in map page
               url(r'^replay/(?P<flight_name>[\w]+)$', views.getFlightPlaybackPage, {}, 'map_replay_flight'),
               url(r'^greplay/(?P<group_flight_name>[\w]+)$', views.getGroupFlightPlaybackPage, {}, 'map_replay_group_flight'),

               # Export datatable rows from search pages to CSV file
               url(r'^search/exportSearchResults/', views.ExportOrderListJson.as_view(), {}, 'exportSearchResults'),

               # Including these in this order ensures that reverse will return the non-rest urls for use in our server
               url(r'^rest/', include('xgds_map_server.restUrls')),
               url('', include('xgds_map_server.restUrls')),
               ]
