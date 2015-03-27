// __BEGIN_LICENSE__
//Copyright © 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

$(document).ready(function() {
    function process_move(node, ref, position,
                         is_copy, is_prepared, skip_check) {
        if (skip_check) return; // we don't want to do moves that aren't checked
        var tree = $.jstree._reference('treeDiv');
        var move = tree._get_move();
        $.get(jsMoveURL, {move: move.o.data('id'),
                          move_type: move.o.data('type'),
                          to: move.np.data('id'),
                          to_type: move.np.data('type')})
            .success(function() {
                console.log('Move succeeded');
                tree.refresh();
            }).fail(function() {
                alert('Move failed');
                tree.refresh();
            });
    }
    $('#treeDiv')
    .bind('move_node.jstree', process_move)
    .jstree({
        'json_data': {
            'ajax': {
                'url': jsTreeMapTreeURL
            },
            'progressive_render': true,
            'progressive_unload': false
        },
        'themes': {
            'theme': 'default',
            'dots': true,
            'icons': true
        },
        'dnd': {
            'drag_target': false,
            'drop_target': false
        },
        'crrm': {
            'move': {
                'check_move': function(move) {
                    var parent = this._get_parent(move.o);
                    if (!parent) return false;
                    parent = parent == -1 ? this.get_container() : parent;
                    if (parent === move.np) return false;
                    if (parent[0] && move.np[0] && parent[0] === move.np[0])
                        return false;
                    if (move.np.data('type') != 'folder') return false;
                    return true;
                }
            }
        },
        'plugins': ['themes', 'json_data', 'dnd', 'crrm']
    });
});
