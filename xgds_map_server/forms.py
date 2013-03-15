# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django import forms

from xgds_map_server import settings
from xgds_map_server.models import Map, MapGroup

class MapForm(forms.ModelForm):
    class Meta:
        model = Map
