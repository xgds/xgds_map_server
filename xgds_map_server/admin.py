# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.contrib import admin

from xgds_map_server import models


class MapAdmin(admin.ModelAdmin):
    list_display = ('id',
                    'name',
                    'parentId',
                    'openable',
                    'visible',
                    'kmlFile',
                    'description')
    list_editable = list_display[1:]
    ordering = ('parentId', 'name')
    search_fields = ('name',
                     'description',
                     'kmlFile')


class MapGroupAdmin(admin.ModelAdmin):
    list_display = ('id',
                    'name',
                    'parentId',
                    'description')
    list_editable = list_display[1:]
    ordering = ('parentId', 'name')
    search_fields = ('name',
                     'description')

admin.site.register(models.Map, MapAdmin)
admin.site.register(models.MapGroup, MapGroupAdmin)
