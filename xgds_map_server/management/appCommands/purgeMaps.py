# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.core.management.base import NoArgsCommand
from xgds_map_server.models import Map, MapGroup

class Command(NoArgsCommand):
    help = 'Purge all maps and map groups with the delete flag set'

    def handle_noargs(self, **options):
        for map_obj in Map.objects.all():
            if map_obj.deleted:
                self.stdout.write("Deleting map \"%s\"" % map_obj.name, ending='\n')
                if map_obj.localFile: map_obj.localFile.delete()
                map_obj.delete()

        for map_group in MapGroup.objects.all():
            if map_group.deleted:
                self.stdout.write("Delete map group \"%s\"" % map_group.name, ending='\n')
                map_group.delete()
