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
Pull maps from some reference server to your local install.
"""

import os
import sys
import time

DEFAULT_LOCATION = 'xserve2:xgds_isru'
_up = os.path.dirname
LOCAL_CHECKOUT = _up(_up(_up(_up(_up(os.path.realpath(__file__))))))
DRY_RUN = False


def dosys(cmd):
    print cmd
    if DRY_RUN:
        ret = 0
    else:
        ret = os.system(cmd)
    if ret != 0:
        print >> sys.stderr, 'warning: command exited with non-zero return value %d' % ret
    return ret


def rsyncMaps(siteLocation):
    server, path = siteLocation.split(':', 1)
    uniq = int(time.time())
    dumpPath = '/tmp/rsyncMaps-%d.json' % uniq

    print '# rsyncing map kml files to local data directory'
    dosys('rsync -rz %s:%s/data/xgds_map_server %s/data'
          % (server, path, LOCAL_CHECKOUT))

    print '# dumping map meta-data from remote db'
    dosys('ssh %s "cd %s && source sourceme.sh && ./manage.py dumpdata xgds_map_server > %s"'
          % (server, path, dumpPath))

    print '# copying map meta-data to local host'
    dosys('rsync %s:%s %s'
          % (server, dumpPath, dumpPath))

    print '# loading map meta-data into local db'
    dosys('cd %s && ./manage.py loaddata %s'
          % (LOCAL_CHECKOUT, dumpPath))


def main():
    import optparse
    parser = optparse.OptionParser('usage: %prog [server:dir]')
    parser.add_option('-d', '--dryRun',
                      action='store_true', default=False,
                      help='Dry run mode (print commands but do not execute them)')
    opts, args = parser.parse_args()
    if len(args) == 1:
        siteLocation = args[0]
    elif len(args) == 0:
        siteLocation = DEFAULT_LOCATION
    else:
        parser.error('expected 0 or 1 args')

    global DRY_RUN
    DRY_RUN = opts.dryRun

    rsyncMaps(siteLocation)


if __name__ == '__main__':
    main()
