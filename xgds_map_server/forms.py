# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django import forms

from xgds_map_server.models import Map, MapGroup

# pylint: disable=C1001


class MapForm(forms.ModelForm):
    parentId = forms.ModelChoiceField(queryset=MapGroup.objects.filter(deleted=False), empty_label=None, label="Parent Folder")
    description = forms.CharField(required=False, widget=forms.Textarea(attrs={'cols': 50, 'rows': 7}))

    class Meta:
        model = Map
        widgets = {
            # Note: no practical way to retrieve max lengths from Map model
            'name': forms.TextInput(attrs={'size': 80})
        }
        exclude = ('deleted',)


class MapGroupForm(forms.ModelForm):
    parentId = forms.ModelChoiceField(queryset=MapGroup.objects.filter(deleted=False),
                                      empty_label=None,
                                      label="Parent Folder")
    description = forms.CharField(required=False, widget=forms.Textarea(attrs={'cols': 50, 'rows': 7}))


    class Meta:
        model = MapGroup
        widgets = {
            # Same note as above
            'name': forms.TextInput(attrs={'size': 80})
        }
        exclude = ('deleted',)
