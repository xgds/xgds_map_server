# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.db import models


class MapGroup(models.Model):
    name = models.CharField('Name', max_length=80)
    description = models.CharField('Description', max_length=2000)
    parentId = models.ForeignKey('self', db_column='parentId',
                                 null=True, blank=True,
                                 verbose_name='parent group')

    class Meta:
        db_table = u'mapgroup'

    def __unicode__(self):
        #return '%s' % self.name + ' : ' + self.description + ' : ' + '%s' % self.parentId
        return self.name


class Map(models.Model):
    name = models.CharField('Name', max_length=80)
    description = models.CharField('Description', max_length=2000)
    kmlFile = models.CharField('KML File', max_length=200)
    openable = models.BooleanField(blank=False)
    visible = models.BooleanField(blank=False)
    parentId = models.ForeignKey(MapGroup, db_column='parentId',
                                 null=True, blank=True,
                                 verbose_name='group')

    class Meta:
        db_table = u'map'

    def __unicode__(self):
        #return self.name + ' : ' + self.kmlFile + ' = ' + self.description + ' visibility = %s' % self.visible + ' openable = %s' % self.openable
        return self.name
