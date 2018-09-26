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

import os
from geocamUtil.SettingsUtil import getOrCreateArray, getOrCreateDict

# Use this if you want to replace the default OSM baselayer with something (like Bing) that needs a key
XGDS_MAP_SERVER_MAP_API_KEY = ""

XGDS_MAP_SERVER_MEDIA_SUBDIR = 'xgds_map_server/'
XGDS_MAP_SERVER_DATA_SUBDIR = 'xgds_map_server/'
XGDS_MAP_SERVER_GEOTIFF_SUBDIR = XGDS_MAP_SERVER_DATA_SUBDIR + 'geoTiff/'
XGDS_MAP_SERVER_MAPDATA_SUBDIR = XGDS_MAP_SERVER_DATA_SUBDIR + 'mapData/'
XGDS_MAP_SERVER_GEOTIFF_UPLOAD_SUBDIR = XGDS_MAP_SERVER_GEOTIFF_SUBDIR + 'upload/'
# FILE_UPLOAD_TEMP_DIR = XGDS_MAP_SERVER_GEOTIFF_SUBDIR + 'temp/'

XGDS_MAP_SERVER_DEFAULT_BACKBONE_APP = 'xgds_map_server/js/map_viewer/mapViewerApp.js'
XGDS_MAP_SERVER_HANDLEBARS_DIRS = [os.path.join('xgds_map_server', 'templates', 'handlebars'),
                                   os.path.join('xgds_map_server', 'templates', 'handlebars', 'search')]


XGDS_MAP_SERVER_OVERLAY_IMAGES_DIR = XGDS_MAP_SERVER_DATA_SUBDIR + "MapOverlayImages"

XGDS_MAP_SERVER_TOP_LEVEL = {
    "name": 'xGDS Maps',
    "description": "Top level KML feed for xGDS maps.",
    "filename": "xgds.kml"
}

# kml root from xgds_map_server
XGDS_MAP_SERVER_LAYER_FEED_URL = "/xgds_map_server/treejson/"
XGDS_MAP_SERVER_SELECTED_LAYER_URL = "/xgds_map_server/selectedjson/"

# path to script to turn geotiffs into tiles, via gdal with our patch
XGDS_MAP_SERVER_GDAL2TILES = "xgds_map_server/bin/gdal2tiles.py"
XGDS_MAP_SERVER_GDAL2TILES_ZOOM_LEVELS = True # if you don't want to customize zoom levels turn this off
XGDS_MAP_SERVER_GDAL2TILES_EXTRAS = ""  # if you have to pass extra parameters to gdal2tiles override this
XGDS_MAP_SERVER_GDAL_RESAMPLE_OPTIONS = [("lanczos", "Lanczos"), ("cubic", "Cubic"),
                                         ("near", "Nearest Neighbor")]

# A list of regex strings. If the name of a Map object matches one of
# the regexes (using re.search), the Map is considered to be a logo. (If
# the map feed is requested with the URL parameter 'logo=0', logo Maps
# have visibility turned off.)
XGDS_MAP_SERVER_LOGO_PATTERNS = []

# if you want to have a custom javascript included in your maps, override this in siteSettings.
# for example:
#    XGDS_MAP_SERVER_PIPELINE_JS = {'custom_map': {'source_filenames': ('plrpExplorer/js/bathymetry.js'),
#                                                 'output_filename': 'js/custom_map_js.js',
#                                                 }
#                               }
# IMPORTANT: we are expecting something named custom_map so don't rename it.
# SUPER IMPORTANT: we also need to define a getInitialLayers() method in javascript so if you are not making your own, keep including the olInitialLayers.js to include OSM.
# and then include it in PIPELINE_JS ie
# PIPELINE_JS.update(XGDS_MAP_SERVER_PIPELINE_JS)
XGDS_MAP_SERVER_PIPELINE_JS = {'custom_map': {'source_filenames': ('xgds_map_server/js/custom_map.js',
                                                                   'xgds_map_server/js/map_viewer/olInitialLayers.js'),
                                              'output_filename': 'js/custom_map.js',
                                              }
                               }

# XGDS_MAP_SERVER_MAP_LOADED_CALLBACK: The fully qualified name of an
# extra JavaScript callback to call after the map is loaded.
XGDS_MAP_SERVER_MAP_LOADED_CALLBACK = 'xgds_map.coordinator.init'


# dict of models to  a dict of javascript files to render the models on the map and the model class
# for example
# XGDS_MAP_SERVER_JS_MAP['Note'] = {'ol': 'plrpExplorer/js/olNoteMap.js',
#                                  'model': 'plrpExplorer.Note',
#                                  'viewHandlebars' : 'mypath/templates/handlebars/myvew.handlebars',
#                                  'hiddenColumns': ['type', 'color', 'alpha', 'times', 'coords'], # you can exclude columns and include all others OR BETTER
#                                  'columns': ['acquisition_time', 'acquisition_timezone', 'name', 'thumbnail_url']} # you can explicitly columns
# these models should ideally have a toMapDict method that returns the dict you would want to use to render the model.
XGDS_MAP_SERVER_JS_MAP = {}

# If you are using spherical mercator this will be the norm.
# If you are not, override the below values. 
XGDS_MAP_SERVER_DEFAULT_COORD_SYSTEM = 'EPSG:3857'
XGDS_MAP_SERVER_DEFAULT_COORD_SYSTEM_CENTER = 'null'
XGDS_MAP_SERVER_DEFAULT_ZOOM = 14
XGDS_MAP_SERVER_DEFAULT_ROTATION = 0    # to set the default rotation for the map view if it is not 0.  In radians.
XGDS_MAP_SERVER_SHOW_COMPASS = 'false' # to show compass control
XGDS_MAP_SERVER_MAP_SETUP_COORD_SYSTEM = 'null'
XGDS_MAP_SERVER_BODY_RADIUS_METERS = 6371010

XGDS_MAP_SERVER_SITE_MONIKER = 'Site'
XGDS_MAP_SERVER_PLACE_MONIKER = 'Place'

# in case you are using this as a default, for example for sample recording
XGDS_MAP_SERVER_DEFAULT_PLACE_ID = None

XGDS_DATA_IMPORTS = getOrCreateDict('XGDS_DATA_IMPORTS')
XGDS_DATA_IMPORTS['GeoTiff Map Tile'] = '/xgds_map_server/addTile'

XGDS_MAP_SERVER_DEFAULT_HOURS_RANGE = 12  # if you are in live mode how many hours back to search through for objects by default

PIPELINE = getOrCreateDict('PIPELINE')

# Override this compilation of javascript files for the map if you want
PIPELINE['JAVASCRIPT'] = getOrCreateDict('PIPELINE.JAVASCRIPT')
PIPELINE['JAVASCRIPT']['custom_map'] = {'source_filenames': ('xgds_map_server/js/map_viewer/olShowMapCoords.js',
                                                              'xgds_map_server/js/map_viewer/olInitialLayers.js',
                                                             ),
                                        'output_filename': 'js/custom_map.js',
                                        }

