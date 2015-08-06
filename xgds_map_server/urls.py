# __BEGIN_LICENSE__
#Copyright (c) 2015, United States Government, as represented by the 
#Administrator of the National Aeronautics and Space Administration. 
#All rights reserved.
#
#The xGDS platform is licensed under the Apache License, Version 2.0 
#(the "License"); you may not use this file except in compliance with the License. 
#You may obtain a copy of the License at 
#http://www.apache.org/licenses/LICENSE-2.0.
#
#Unless required by applicable law or agreed to in writing, software distributed 
#under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
#CONDITIONS OF ANY KIND, either express or implied. See the License for the 
#specific language governing permissions and limitations under the License.
# __END_LICENSE__

from django.conf.urls import *  # pylint: disable=W0401

from django.conf import settings
from xgds_map_server import views

urlpatterns = patterns(
    '',

    (r'^$', views.getMapServerIndexPage,
     {'readOnly': True, 'securityTags': ['readOnly']},
     'xgds_map_server_index'),
    (r'^$', views.getMapServerIndexPage,
     {'readOnly': True, 'securityTags': ['readOnly']},
     'map'),
    (r'^feedPage/', views.getGoogleEarthFeedPage,
     {'readOnly': True, 'securityTags': ['readOnly']},
     'xgds_map_server_feed'),
    # Map server urls
    # HTML list of maps with description and links to individual maps, and a link to the kml feed
    # (r'^list/', views.getMapListPage,
    # {'readOnly': True, 'securityTags': ['readOnly']},
    # 'mapList'),
    # for saving feature json to db
    (r'^feature$', views.saveOrDeleteFeature, {}, 
     'saveOrDeleteFeature'),
    (r'^feature/(?P<uuid>[\w-]+)$', views.saveOrDeleteFeature, {}, 
     'saveOrDeleteFeature'),
    # for saving feature json to db
    (r'^saveMaplayer.json$', views.saveMaplayer, {}, 
     'saveMaplayer'),
    # HTML tree of maps
    (r'^maptree/', views.getMapTreePage,
     {'readOnly': True, 'securityTags': ['readOnly']},
     'mapTree'),
    # Open Map Editor on a particular map layer
    (r'^mapeditor/(?P<layerID>[\w-]+)/', views.getMapEditorPage,
     {},
     'mapEditLayer'),
    # JSON tree of maps, formatted for jstree
    (r'^listjson/', views.getMapTreeJSON,
     {'readOnly': True, 'loginRequired': False, 'securityTags': ['readOnly']},
     'mapListJSON'),
    (r'^treejson/', views.getFancyTreeJSON, {'readOnly': True, 'loginRequired': False, 'securityTags': ['readOnly']}, 'mapTreeJSON'),
    (r'^selectedjson/', views.getSelectedNodesJSON, {'readOnly': True, 'loginRequired': False, 'securityTags': ['readOnly']}, 'mapSelectedJSON'),
    (r'^mapLayerJSON/(?P<layerID>[\w-]+)/', views.getMapLayerJSON, {'readOnly': True, 'loginRequired': False, 'securityTags': ['readOnly']}, 'mapLayerJSON'),
    # HTML detail view of map
    (r'^detail/(?P<mapID>[\w-]+)/', views.getMapDetailPage,
     {'readOnly': True },
     'mapDetail'),
    # HTML detail of a folder (group)
    (r'^folderDetail/(?P<groupID>[\w-]+)/', views.getFolderDetailPage, {'readOnly': True}, 'folderDetail'),
    # HTML view to delete a folder (group)
    (r'^folderDelete/(?P<groupID>[\w-]+)/', views.getDeleteFolderPage, {}, 'folderDelete'),
    # HTML view to add a folder (group)
    (r'^folderAdd/', views.getAddFolderPage, {}, 'folderAdd'),
    # HTML view to add new map
    (r'^addkml/', views.getAddKmlPage, {}, 'addKml'),
    (r'^addlayer/', views.getAddLayerPage, {}, 'mapAddLayer'),
    (r'^addTile/', views.getAddTilePage, {}, 'mapAddTile'),
    (r'^editTile/(?P<tileID>[\w-]+)/', views.getEditTilePage, {}, 'mapEditTile'),
    (r'^addMapSearch/', views.getAddMapSearchPage, {}, 'mapAddMapSearch'),
    (r'^editMapSearch/(?P<mapSearchID>[\w-]+)/', views.getEditMapSearchPage, {}, 'mapEditMapSearch'),
    (r'^addMapCollection/', views.getAddMapCollectionPage, {}, 'mapAddMapCollection'),
    (r'^editMapCollection/(?P<mapCollectionID>[\w-]+)/', views.getEditMapCollectionPage, {}, 'mapEditMapCollection'),
    (r'^mapCollectionJSON/(?P<mapCollectionID>[\w-]+)/', views.getMapCollectionJSON, {'readOnly': True, 'loginRequired': False, 'securityTags': ['readOnly']}, 'mapCollectionJSON'),
    (r'^mapSearchJSON/(?P<mapSearchID>[\w-]+)/', views.getMapSearchJSON, {'readOnly': True, 'loginRequired': False, 'securityTags': ['readOnly']}, 'mapSearchJSON'),
    (r'^doMapSearch/', views.searchWithinMap, {}, 'doMapSearch'),
    (r'^saveMapSearch/', views.saveSearchWithinMap, {}, 'saveMapSearch'),

    # HTML view to confirm deletion of view
    (r'^delete/(?P<nodeID>[\w-]+)/', views.getDeleteNodePage, {}, 'nodeDelete'),
    # List of deleted maps that can be un-deleted
    (r'^deleted/', views.getDeletedNodesPage, {'readOnly': True}, 'deletedNodes'),
    # JSON-accepting url that moves maps/folders around
    (r'^moveNode', views.moveNode, {}, 'moveNode'),
    # JSON-accepting url that changes visibility for a node
    (r'^setNodeVisibility', views.setNodeVisibility, {}, 'setNodeVisibility'),

    # --- this url is deprecated, don't use it in new code ---
    # This URL should receive a static files
    (r'^data/(?P<path>.*)$', 'django.views.static.serve',
     {'document_root': settings.DATA_URL + settings.XGDS_MAP_SERVER_DATA_SUBDIR,
      'show_indexes': True,
      'readOnly': True},
     'xgds_map_server_static'),

    # By default if you just load the app you should see the list
    (r'^feed/(?P<feedname>.*)', views.getMapFeed,
     {'readOnly': True, 'loginRequired': False, 'securityTags': ['kml', 'readOnly']},'xgds_map_server_feed'),
)
