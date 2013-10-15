# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.core.management.base import NoArgsCommand
from django.db import transaction
from xgds_map_server.models import Map, MapGroup


class Command(NoArgsCommand):
    help = 'Purge all maps and map groups with the delete flag set'
    requires_model_validation = True

    @transaction.commit_manually
    def handle_noargs(self, **options):
        self.stdout.write("Looking for maps to delete...\n")
        for map_obj in Map.objects.all():
            if map_obj.deleted:
                self.stdout.write("Deleting map \"%s\"\n" % map_obj.name)
                if map_obj.localFile:
                    map_obj.localFile.delete()
                map_obj.delete()

        self.stdout.write("Looking for map groups to delete...\n")
        for map_group in MapGroup.objects.all():
            if map_group.deleted:
                self.stdout.write("Deleting map group \"%s\"\n" % map_group.name)
                map_group.delete()

        self.stdout.write("Committing changes...\n")
        transaction.commit()
