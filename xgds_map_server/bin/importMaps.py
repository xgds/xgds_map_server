#!/usr/bin/env python

import sys
import os
import stat

from xgds_map_server.models import Map, MapGroup
from xgds_map_server import settings

def getName(path):
    return re.sub('_', ' ', os.path.basename(path))

def importMaps(parent, paths):
    if isinstance(parent, str):
        parent = MapGroup.objects.get(parent)
    mapDir = os.path.realpath(settings.DATA_ROOT + settings.XGDS_MAP_SERVER_DATA_SUBDIR)
    cwd = os.path.realpath(os.getcwd())
    if mapDir != cwd:
        print >>sys.stderr, 'error: you must cd to the map data dir first:'
        print >>sys.stderr, '  cd %s' % mapDir
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
                for sub in os.listdir(path):
                    importMaps(group, os.path.join(path, sub))
            elif os.path.isfile(path):
                map, created = (Map.objects.get_or_create
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
                print >>sys.stderr, 'warning: path %s is not a dir or a file, skipping'
        else:
            print >>sys.stderr, 'warning: path %s does not exist, skipping' % path

def main():
    import optparse
    parser = optparse.OptionParser('usage: %prog')
    parser.add_option('-p', '--parent',
                      help='parent dir to put new maps in')
    opts, args = parser.parse_args()
    importMaps(opts.parent, args)

if __name__ == '__main__':
    main()
