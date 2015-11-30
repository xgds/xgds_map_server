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
