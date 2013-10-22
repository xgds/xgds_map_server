# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# import logging

from django.test import TestCase
from django.core.urlresolvers import reverse


class TestMaps(TestCase):
    """
    Tests for xgds_map_server
    """

    def test_index(self):
        response = self.client.get(reverse('xgds_map_server_index'))
        self.assertEqual(response.status_code, 200)

    def test_list(self):
        response = self.client.get(reverse('mapList'))
        self.assertEqual(response.status_code, 200)

    def test_mapList(self):
        response = self.client.get(reverse('mapList'))
        self.assertEqual(response.status_code, 200)

    def test_mapTree(self):
        response = self.client.get(reverse('mapTree'))
        self.assertEqual(response.status_code, 200)

    # TODO needs a fixture (assumes there is a root group)
    # def test_mapListJSON(self):
    #     response = self.client.get(reverse('mapListJSON'))
    #     self.assertEqual(response.status_code, 200)

    # TODO needs fixture
    # def test_mapDetail(self):
    #     mapId = '...'
    #     response = self.client.get(reverse('mapDetail', args=[mapId]))
    #     self.assertEqual(response.status_code, 200)

    # TODO needs fixture
    # def test_folderDetail(self):
    #     groupId = '...'
    #     response = self.client.get(reverse('folderDetail', args=[groupId]))
    #     self.assertEqual(response.status_code, 200)

    # TODO needs fixture
    # def test_folderDelete(self):
    #     groupId = '...'
    #     response = self.client.get(reverse('folderDelete', args=[groupId]))
    #     self.assertEqual(response.status_code, 200)

    # TODO figure out post args
    # def test_folderAdd(self):
    #     response = self.client.get(reverse('folderAdd'))
    #     self.assertEqual(response.status_code, 200)

    # FIX do a post
    # def test_addMap(self):
    #     response = self.client.get(reverse('addMap'))
    #     self.assertEqual(response.status_code, 200)

    # FIX do a post
    # def test_mapDelete(self):
    #     response = self.client.get(reverse('mapDelete'))
    #     self.assertEqual(response.status_code, 200)

    def test_deletedMaps(self):
        response = self.client.get(reverse('deletedMaps'))
        self.assertEqual(response.status_code, 200)

    # FIX do a post
    # def test_jsonMove(self):
    #     response = self.client.get(reverse('jsonMove'))
    #     self.assertEqual(response.status_code, 200)

    # FIX test fails... is this view used anyway?
    # def test_static(self):
    #     logging.info('test_static: %s', reverse('xgds_map_server_static', args=['']))
    #     response = self.client.get(reverse('xgds_map_server_static', args=['']))
    #     self.assertEqual(response.status_code, 200)

    # TODO needs fixture
    # def test_feed(self):
    #     feedName = '...'
    #     response = self.client.get(reverse('xgds_map_server_feed', args=[feedName]))
    #     self.assertEqual(response.status_code, 200)
