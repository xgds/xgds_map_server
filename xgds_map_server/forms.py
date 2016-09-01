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

import datetime
import pytz

from django import forms
from django.conf import settings
from django.core.urlresolvers import reverse
from django.forms.fields import IntegerField, ChoiceField

from resumable.fields import ResumableFileField

from xgds_map_server.models import KmlMap, MapGroup, MapLayer, MapTile, MapCollection, MapSearch, MapDataTile
from xgds_data.models import Collection, RequestLog

# pylint: disable=C1001


class AbstractMapForm(forms.ModelForm):
    parent = forms.ModelChoiceField(queryset=MapGroup.objects.filter(deleted=False), empty_label=None, label="Parent Folder")
    username = forms.CharField(required=False, widget=forms.HiddenInput())
    
    def getModel(self):
        return None

    def getExclude(self):
        return ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted']

    def getParentGroup(self):
        mapGroupName = self.cleaned_data['parent']
        foundParents = MapGroup.objects.filter(name=mapGroupName)
        return foundParents[0]

    class Meta:
        abstract = True
#         model = self.getModel()
        widgets = {
            # Note: no practical way to retrieve max lengths from Map model
            'name': forms.TextInput(attrs={'size': 50}),
            'description': forms.Textarea(attrs={'cols': 50, 'rows': 7})
        }
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted']


class MapForm(AbstractMapForm):
    class Meta(AbstractMapForm.Meta):
        model = KmlMap


class MapGroupForm(AbstractMapForm):
    class Meta(AbstractMapForm.Meta):
        model = MapGroup


class MapLayerForm(AbstractMapForm):
    class Meta(AbstractMapForm.Meta):
        model = MapLayer


class MapTileForm(AbstractMapForm):
    minZoom = IntegerField(initial=12, label="Min Zoom")
    maxZoom = IntegerField(initial=20, label="Max Zoom (UAV=23, Satellite=20)")
    
    resampleMethod = ChoiceField(choices=settings.XGDS_MAP_SERVER_GDAL_RESAMPLE_OPTIONS,
                                 label="Resampling Method")

    sourceFile = ResumableFileField(allowed_mimes=("image/tiff",),
                                    upload_url=lambda: reverse('uploadResumable'),
                                    chunks_dir=getattr(settings, 'FILE_UPLOAD_TEMP_DIR'),
                                    label="GeoTiff Source File"
                                    )

    def save(self, commit=True):
        instance = super(MapTileForm, self).save(commit=False)
        instance.creator = self.username
        instance.creation_time = datetime.datetime.now(pytz.utc)
        instance.parent = self.getParentGroup()
        if commit:
            instance.save()
        
    
    class Meta(AbstractMapForm.Meta):
        model = MapTile
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted', 'processed']


class MapDataTileForm(MapTileForm):
    dataFile = ResumableFileField(allowed_mimes=("image/tiff",),
                                  upload_url=lambda: reverse('uploadResumable'),
                                  chunks_dir=getattr(settings, 'FILE_UPLOAD_TEMP_DIR'),
                                  label="Data File"
                                  )
    
    legendFile = ResumableFileField(allowed_mimes=("image/png",),
                                  upload_url=lambda: reverse('uploadResumable'),
                                  chunks_dir=getattr(settings, 'FILE_UPLOAD_TEMP_DIR'),
                                  label="Legend File (png, vertical)"
                                  )
    
    class Meta(AbstractMapForm.Meta):
        model = MapDataTile
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted', 'processed']

class EditMapTileForm(AbstractMapForm):
    
    class Meta(AbstractMapForm.Meta):
        model = MapTile
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted', 'processed', 'sourceFile', ]

class EditMapDataTileForm(EditMapTileForm):
    class Meta(AbstractMapForm.Meta):
        model = MapDataTile

class CollectionModelChoiceField(forms.ModelChoiceField):
    def label_from_instance(self, obj):
        return obj.name


class MapCollectionForm(AbstractMapForm):
    collection = CollectionModelChoiceField(queryset=Collection.objects.all().order_by('name'), empty_label=None)

    class Meta(AbstractMapForm.Meta):
        model = MapCollection


class MapSearchForm(AbstractMapForm):

    class Meta(AbstractMapForm.Meta):
        model = MapSearch
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted', 'requestLog', 'locked', 'visible', 'mapBounded']
    
