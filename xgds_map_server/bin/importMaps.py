#!/usr/bin/env python
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

"""
To use this script, cd into the map server data directory, then run it
with args set to the names of directories or kml files (within that
data directory!) you want to import into the map server db.

Example:

 cd ~/xgds_drats/data/xgds_map_server
 ~/xgds_drats/apps/xgds_map_server/bin/importMaps.py opsMaps/ geologyMaps/

"""

import sys
import os
import re

from xgds_map_server.models import Map, MapGroup
from xgds_map_server import settings


def getName(path):
    path = os.path.basename(path)
    path = os.path.splitext(path)[0]
    path = re.sub('_', ' ', path)
    return path


def importMaps(parent, paths):
    if isinstance(parent, str):
        parent = MapGroup.objects.get(parent)
    elif parent is None:
        print 'no parent specified, fetching the root MapGroup to use as the parent'
        parent = MapGroup.objects.get(parentId=None)
    mapDir = os.path.realpath(os.path.join(settings.DATA_ROOT, settings.XGDS_MAP_SERVER_DATA_SUBDIR))
    cwd = os.path.realpath(os.getcwd())
    if mapDir != cwd:
        print >> sys.stderr, 'error: you must cd to the map data dir first:'
        print >> sys.stderr, '  cd %s' % mapDir
        sys.exit()
    for path in paths:
        path = os.path.realpath(path)
        if os.path.exists(path):
            name = getName(path)
            if os.path.isdir(path):
                group, created = (MapGroup.objects.get_or_create
                                  (name=name,
                                   defaults=dict(description='-',
                                                 parentId=parent)))
                if created:
                    print 'add    MapGroup %s -- parent %s' % (name, parent.name)
                else:
                    print 'exists MapGroup %s' % name
                importMaps(group, [os.path.join(path, sub)
                                   for sub in os.listdir(path)
                                   if not sub.startswith('.')])
            elif os.path.isfile(path):
                ext = os.path.splitext(path)[1]
                if ext not in ('.kml', '.kmz'):
                    print 'file %s is not a map, skipping' % path
                    continue
                _map, created = (Map.objects.get_or_create
                                 (name=name,
                                  defaults=dict(description='-',
                                                kmlFile=os.path.relpath(path),
                                                openable=True,
                                                visible=False,
                                                parentId=parent)))
                if created:
                    print 'add    Map %s -- parent %s' % (name, parent.name)
                else:
                    print 'exists Map %s' % name
            else:
                print >> sys.stderr, 'warning: path %s is not a dir or a file, skipping'
        else:
            print >> sys.stderr, 'warning: path %s does not exist, skipping' % path


def main():
    import optparse
    parser = optparse.OptionParser('usage: %prog')
    parser.add_option('-p', '--parent',
                      help='parent dir to put new maps in')
    opts, args = parser.parse_args()
    importMaps(opts.parent, args)

if __name__ == '__main__':
    main()
