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

from django import forms

from xgds_map_server.models import KmlMap, MapGroup, MapLayer, MapTile
from xgds_map_server import settings


# pylint: disable=C1001


class MapForm(forms.ModelForm):
    """ This is really for kml
    """
    parent = forms.ModelChoiceField(queryset=MapGroup.objects.filter(deleted=False), empty_label=None, label="Parent Folder")
    description = forms.CharField(required=False, widget=forms.Textarea(attrs={'cols': 50, 'rows': 7}))

    class Meta:
        model = KmlMap
        widgets = {
            # Note: no practical way to retrieve max lengths from Map model
            'name': forms.TextInput(attrs={'size': 80})
        }
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted']


class MapGroupForm(forms.ModelForm):
    parent = forms.ModelChoiceField(queryset=MapGroup.objects.filter(deleted=False),
                                      empty_label=None,
                                      label="Parent Folder")

    class Meta:
        model = MapGroup
        widgets = {
            'name': forms.TextInput(attrs={'size': 80}),
            'description': forms.Textarea(attrs={'cols': 50, 'rows': 7})
        }
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted']


class MapLayerForm(forms.ModelForm):
    parent = forms.ModelChoiceField(queryset=MapGroup.objects.filter(deleted=False),
                                    empty_label=None,
                                    label="Parent Folder")

    class Meta:
        model = MapLayer
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted', 
                   'polygonIndex', 'lineStringIndex', 'pointIndex', 'groundOverlayIndex', 'drawingIndex']
        widgets = {'name': forms.TextInput(attrs={'size': 80}),
                   'description': forms.Textarea(attrs={'cols': 50, 'rows': 7})
                   }


class MapTileForm(forms.ModelForm):
    sourceFile = forms.FileField()
    parent = forms.ModelChoiceField(queryset=MapGroup.objects.filter(deleted=False),
                                    empty_label=None,
                                    label="Parent Folder")

    class Meta:
        model = MapTile
        exclude = ['creator', 'modifier', 'creation_time', 'modification_time', 'deleted', 'processed']
        widgets = {'name': forms.TextInput(attrs={'size': 80}),
                   'description': forms.Textarea(attrs={'cols': 50, 'rows': 7})
                   }
