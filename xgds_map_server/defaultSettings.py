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

XGDS_MAP_SERVER_MEDIA_SUBDIR = 'xgds_map_server/'
XGDS_MAP_SERVER_DATA_SUBDIR = 'xgds_map_server/'
XGDS_MAP_SERVER_TEMPLATE_DEBUG = True  # If this is true, handlebars templates will not be cached.

XGDS_MAP_SERVER_OVERLAY_IMAGES_DIR = XGDS_MAP_SERVER_DATA_SUBDIR + "MapOverlayImages"

XGDS_MAP_SERVER_TOP_LEVEL = {
    "name": "xGDS Maps",
    "description": "Top level KML feed for xGDS maps.",
    "filename": "xgds.kml"
}

# kml root from xgds_map_server
XGDS_MAP_SERVER_LAYER_FEED_URL = "/xgds_map_server/treejson/"


# A list of regex strings. If the name of a Map object matches one of
# the regexes (using re.search), the Map is considered to be a logo. (If
# the map feed is requested with the URL parameter 'logo=0', logo Maps
# have visibility turned off.)
XGDS_MAP_SERVER_LOGO_PATTERNS = []

# include this in your siteSettings.py BOWER_INSTALLED_APPS
XGDS_MAP_SERVER_BOWER_INSTALLED_APPS = (
    'fancytree',
    'ol3-popup'
)
