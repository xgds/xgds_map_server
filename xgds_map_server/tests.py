# __BEGIN_LICENSE__
#Copyright © 2015, United States Government, as represented by the 
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

# import logging

# TODO: write tests that do more than check pages with GET requests.

from django.test import TestCase
from django.core.urlresolvers import reverse
from unittest import skip


class TestMaps(TestCase):
    fixtures = ['xgds_map_server_testing.json',
                'xgds_map_server_auth.json']
    urls = "xgds_map_server.testing_urls"

    def test_index(self):
        response = self.client.get(reverse('xgds_map_server_index'))
        self.assertEqual(response.status_code, 200)

    @skip('Url disabled in urls.py')
    def test_mapList(self):
        response = self.client.get(reverse('mapList'))
        self.assertEqual(response.status_code, 200)

    def test_mapTree(self):
        response = self.client.get(reverse('mapTree'))
        self.assertEqual(response.status_code, 200)

    def test_mapListJSON(self):
        response = self.client.get(reverse('mapListJSON'))
        self.assertEqual(response.status_code, 200)

    def test_mapDetail(self):
        mapId = '1'
        response = self.client.get(reverse('mapDetail', args=[mapId]))
        self.assertEqual(response.status_code, 200)

    def test_folderDetail(self):
        groupId = '1'
        response = self.client.get(reverse('folderDetail', args=[groupId]))
        self.assertEqual(response.status_code, 200)

    def test_folderDelete(self):
        groupId = '1'
        response = self.client.get(reverse('folderDelete', args=[groupId]))
        self.assertEqual(response.status_code, 200)

    def test_folderAdd(self):
        response = self.client.get(reverse('folderAdd'))
        self.assertEqual(response.status_code, 200)

    def test_addMap(self):
        response = self.client.get(reverse('addMap'))
        self.assertEqual(response.status_code, 200)

    def test_mapDelete(self):
        mapId = '1'
        response = self.client.get(reverse('mapDelete', args=[mapId]))
        self.assertEqual(response.status_code, 200)

    def test_deletedMaps(self):
        response = self.client.get(reverse('deletedMaps'))
        self.assertEqual(response.status_code, 200)

    @skip('Test is broken')
    def test_jsonMove(self):
        response = self.client.get(reverse('jsonMove'))
        self.assertEqual(response.status_code, 200)

    # The xgds_map_server_static function was a hack I think I (Jerome) created because
    # I didn't know how to work the static file settings. Indeed it isn't used.

    def test_feed(self):
        # currently the only feed possible is the master feed
        feedName = ''
        response = self.client.get(reverse('xgds_map_server_feed', args=[feedName]))
        self.assertEqual(response.status_code, 200)
