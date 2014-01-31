# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import re

from django.db import models

from xgds_map_server import settings

# pylint: disable=C1001

LOGO_REGEXES = None


class MapGroup(models.Model):
    name = models.CharField('Name', max_length=80)
    description = models.CharField('Description', max_length=2000)
    parentId = models.ForeignKey('self', db_column='parentId',
                                 null=True, blank=True,
                                 verbose_name='parent group')
    deleted = models.BooleanField(blank=True, default=False)

    class Meta:
        db_table = u'mapgroup'

    def __unicode__(self):
        #return '%s' % self.name + ' : ' + self.description + ' : ' + '%s' % self.parentId
        return self.name


class Map(models.Model):
    name = models.CharField('Name', max_length=80)
    description = models.CharField('Description', max_length=2000)
    kmlFile = models.CharField('KML File', max_length=200)
    localFile = models.FileField(upload_to=settings.XGDS_MAP_SERVER_MEDIA_SUBDIR, max_length=256,
                                 null=True, blank=True)
    openable = models.BooleanField(default=True)
    visible = models.BooleanField(blank=False)
    parentId = models.ForeignKey(MapGroup, db_column='parentId',
                                 null=True, blank=True,
                                 verbose_name='group')
    deleted = models.BooleanField(blank=True, default=False)

    class Meta:
        db_table = u'map'

    @property
    def isLogo(self):
        global LOGO_REGEXES
        if LOGO_REGEXES is None:
            LOGO_REGEXES = [re.compile(pattern)
                            for pattern in settings.XGDS_MAP_SERVER_LOGO_PATTERNS]
        return any([r.search(self.name)
                    for r in LOGO_REGEXES])

    def __unicode__(self):
        #return self.name + ' : ' + self.kmlFile + ' = ' + self.description + ' visibility = %s' % self.visible + ' openable = %s' % self.openable
        return self.name
