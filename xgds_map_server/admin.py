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

from django.contrib import admin

from xgds_map_server import models


class KmlMapAdmin(admin.ModelAdmin):
    list_display = ('uuid',
                    'name',
                    'parent',
                    'openable',
                    'visible',
                    'kmlFile',
                    'description')
    list_editable = list_display[1:]
    ordering = ('parent', 'name')
    search_fields = ('name',
                     'description',
                     'kmlFile')


class MapLayerAdmin(admin.ModelAdmin):
    list_display = ('uuid',
                    'name',
                    'parent',
                    'visible',
                    'description')
    list_editable = list_display[1:]
    ordering = ('parent', 'name')
    search_fields = ('name',
                     'description')


class MapGroupAdmin(admin.ModelAdmin):
    list_display = ('uuid',
                    'name',
                    'parent',
                    'description')
    list_editable = list_display[1:]
    ordering = ('parent', 'name')
    search_fields = ('name',
                     'description')

admin.site.register(models.KmlMap, KmlMapAdmin)
admin.site.register(models.MapGroup, MapGroupAdmin)
admin.site.register(models.MapLayer, MapLayerAdmin)
#TODO make admin classes for other map layer stuff below
admin.site.register(models.MapTile)
admin.site.register(models.LabelStyle)
admin.site.register(models.PolygonStyle)
admin.site.register(models.LineStringStyle)
admin.site.register(models.PointStyle)
admin.site.register(models.Icon)
admin.site.register(models.DrawingStyle)
admin.site.register(models.GroundOverlayStyle)
admin.site.register(models.Polygon)
admin.site.register(models.LineString)
admin.site.register(models.Point)
admin.site.register(models.Drawing)
admin.site.register(models.GroundOverlay)
