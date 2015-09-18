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

import os

XGDS_MAP_SERVER_MEDIA_SUBDIR = 'xgds_map_server/'
XGDS_MAP_SERVER_DATA_SUBDIR = 'xgds_map_server/'
XGDS_MAP_SERVER_GEOTIFF_SUBDIR = XGDS_MAP_SERVER_DATA_SUBDIR + 'geoTiff/'

XGDS_MAP_SERVER_TEMPLATE_DEBUG = True  # If this is true, handlebars templates will not be cached.
XGDS_MAP_SERVER_HANDLEBARS_DIRS = [os.path.join('xgds_map_server', 'templates', 'handlebars'),
                                   os.path.join('xgds_map_server', 'templates', 'handlebars', 'search')]


XGDS_MAP_SERVER_OVERLAY_IMAGES_DIR = XGDS_MAP_SERVER_DATA_SUBDIR + "MapOverlayImages"

XGDS_MAP_SERVER_TOP_LEVEL = {
    "name": "xGDS Maps",
    "description": "Top level KML feed for xGDS maps.",
    "filename": "xgds.kml"
}

# kml root from xgds_map_server
XGDS_MAP_SERVER_LAYER_FEED_URL = "/xgds_map_server/treejson/"
XGDS_MAP_SERVER_SELECTED_LAYER_URL = "/xgds_map_server/selectedjson/"

# path to script to turn geotiffs into tiles, via gdal with our patch
XGDS_MAP_SERVER_GDAL2TILES = "xgds_map_server/bin/gdal2tiles.py"


# A list of regex strings. If the name of a Map object matches one of
# the regexes (using re.search), the Map is considered to be a logo. (If
# the map feed is requested with the URL parameter 'logo=0', logo Maps
# have visibility turned off.)
XGDS_MAP_SERVER_LOGO_PATTERNS = []

# include this in your siteSettings.py BOWER_INSTALLED_APPS
XGDS_MAP_SERVER_BOWER_INSTALLED_APPS = ('sprintf.js=sprintf.js',
                                        'lodash',
                                        'handlebars=git://github.com/components/handlebars.js.git',
                                        'backbone#1.1.2',
                                        'marionette=marionette',
                                        'backbone-relational',
                                        'backbone-forms',
                                        'fancytree=fancytree',
                                        'jquery-cookie=git://github.com/carhartl/jquery-cookie.git',
                                        'openlayers3=https://github.com/openlayers/ol3/releases/download/v3.9.0/v3.9.0-dist.zip', 
                                        'ol3-popup',
                                        'proj4',
                                        )

# if you want to have a custom javascript included in your maps, override this in siteSettings.
# for example:
#    XGDS_MAP_SERVER_PIPELINE_JS = {'custom_map': {'source_filenames': ('plrpExplorer/js/bathymetry.js'),
#                                                 'output_filename': 'js/custom_map_js.js',
#                                                 }
#                               }
# IMPORTANT: we are expecting something named custom_map so don't rename it.
# and then include it in PIPELINE_JS ie
# PIPELINE_JS.update(XGDS_MAP_SERVER_PIPELINE_JS)
XGDS_MAP_SERVER_PIPELINE_JS = {'custom_map': {'source_filenames': ('xgds_map_server/js/custom_map.js'),
                                              'output_filename': 'js/custom_map.js',
                                              }
                               }

# XGDS_MAP_SERVER_MAP_LOADED_CALLBACK: The fully qualified name of an
# extra JavaScript callback to call after the map is loaded.
XGDS_MAP_SERVER_MAP_LOADED_CALLBACK = 'null'

# dict of models to  a dict of javascript files to render the models on the map and the model class
# for example
# XGDS_MAP_SERVER_JS_MAP['Note'] = {'ol': 'plrpExplorer/js/olNoteMap.js',
#                                  'model': 'plrpExplorer.Note'}
# these models should ideally have a toMapDict method that returns the dict you would want to use to render the model.
XGDS_MAP_SERVER_JS_MAP = {}

# If you are using spherical mercator this will be the norm.
# If you are not, override the below values. 
XGDS_MAP_SERVER_DEFAULT_COORD_SYSTEM = 'EPSG:3857'
XGDS_MAP_SERVER_DEFAULT_COORD_SYSTEM_CENTER = 'null'
XGDS_MAP_SERVER_MAP_SETUP_COORD_SYSTEM = 'null'
