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

# import logging

# TODO: write tests that do more than check pages with GET requests.
from unittest import skip

from django.test import TransactionTestCase
from django.core.urlresolvers import reverse
from django.conf import settings
from django.utils import timezone

from xgds_map_server.models import Place
from geocamUtil.models import SiteFrame

from django.contrib.auth.models import User


class TestMaps(TransactionTestCase):
    fixtures = ['xgds_map_server_testing.json']
    urls = "xgds_map_server.testing_urls"

    def test_index(self):
        response = self.client.get(reverse('xgds_map_server_index'))
        self.assertEqual(response.status_code, 200)

    def test_mapTree(self):
        response = self.client.get(reverse('mapTree'))
        self.assertEqual(response.status_code, 200)

    def test_mapDetail(self):
        mapId = '2'
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

    def test_addKml(self):
        response = self.client.get(reverse('addKml'))
        self.assertEqual(response.status_code, 200)

    def test_nodeDelete(self):
        mapId = '1'
        response = self.client.get(reverse('nodeDelete', args=[mapId]))
        self.assertEqual(response.status_code, 200)

    def test_deletedNodes(self):
        response = self.client.get(reverse('deletedNodes'))
        self.assertEqual(response.status_code, 200)

    def test_moveNode(self):
        data = {'nodeUuid':2,'parentUuid':1}
        response = self.client.post(reverse('moveNode'), data=data)
        self.assertEqual(response.status_code, 200)

    def test_feed(self):
        # currently the only feed possible is the master feed
        feedName = ''
        response = self.client.get(reverse('xgds_map_server_feed', args=[feedName]))
        self.assertEqual(response.status_code, 200)

    def test_feed_page(self):
        # currently the only feed possible is the master feed
        response = self.client.get(reverse('xgds_map_server_feed_page'))
        self.assertEqual(response.status_code, 200)

    def test_add_place(self):
        site_frame = SiteFrame.objects.first()
        user = User.objects.first()
        place = Place(name='Test Place', creator=user,
                      creation_time=timezone.now(),
                      region=site_frame)
        Place.add_root(instance=place)
        self.assertIsNotNone(place.pk)
        self.assertEqual(place.name, 'Test Place')
        self.assertEqual(place.creator, user)
        self.assertEqual(place.region, site_frame)

        child_place = Place(name='Child Place', creator=user,
                            creation_time=timezone.now(),
                            region=site_frame)
        place.add_child(instance=child_place)
        self.assertIsNotNone(child_place.pk)





