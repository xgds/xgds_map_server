//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

app.views = app.views || {};

app.views.FancyTreeView = Marionette.View.extend({
    template: '#template-layer-tree',
    initialize: function() {
        this.listenTo(app.vent, 'refreshTree', function() {this.refreshTree()});
        this.listenTo(app.vent, 'treeData:loaded', function() {this.createTree()});
        this.listenTo(app.vent, 'tree:expanded', function(node) {
        	if (transparencySlidersVisible) {
        		showTransparencySliders(node);
        	}
        });
        
        this.storedParent = null;
    },
    render: function() {
        if (!_.isUndefined(app.tree) && !_.isNull(this.storedParent)){
            // rerender existing tree
            this.storedParent.append(this.$el);
            this.$el.show();
        } else {
        	Marionette.View.prototype.render.call(this);
        }
    },
    onAttach: function() {
    	app.vent.trigger('layerView:onAttach');
    	this.connectFilter();
    },
    onRender: function() {
        app.vent.trigger('layerView:onRender');
        if (!_.isUndefined(app.tree)) {
            // rerendering tree
            return;
        }
        this.createTree();
        return;
    },
    refreshTree: function() {
        if (!_.isUndefined(app.tree)){
            app.tree.reload({
                url: app.options.layerFeedUrl
            }).done(function(){
                //TODO implement
                app.vent.trigger('layerView:reloadLayers');
            });
        }
    },
    destroy: function() {
      // don't really destroy
        this.$el.hide();
    },
    close: function() {
      // we don't really want to close!
    },
    getTreeIcon: function(key) {
    	var image = "/static/xgds_map_server/icons/";
    	switch (key) {
	        case "MapLink":
	            return image + "link-16.png";
	        case "KmlMap":
	            return image + "gearth.png";
	        case "MapLayer":
	            return image + "maplayer.png"; //TODO change it to whatever you want.
	        case "MapTile":
	            return image + "tif.png";
	        case "MapDataTile":
	            return image + "dataTif.png";
	    }
    	return null
    },
    connectFilter: function() {
    	$("button#btnResetSearch").click(function(e){
    	      $("input[name=searchTree]").val("");
    	      $("span#matches").text("");
    	      app.tree.clearFilter();
    	    }).attr("disabled", true);
    	
    	$("input[name=searchTree]").keyup(function(e){
    	      var n,
    	        opts = {
    	          autoExpand: true,
    	          leavesOnly: false
    	        },
    	        match = $(this).val();

    	      if(e && e.which === $.ui.keyCode.ESCAPE || $.trim(match) === ""){
    	        $("button#btnResetSearch").click();
    	        return;
    	      }
//    	      if($("#regex").is(":checked")) {
//    	        // Pass function to perform match
//    	        n = app.tree.filterNodes(function(node) {
//    	          return new RegExp(match, "i").test(node.title);
//    	        }, opts);
//    	      } else {
    	        // Pass a string to perform case insensitive matching
    	        n = app.tree.filterNodes(match, opts);
//    	      }
    	      $("button#btnResetSearch").attr("disabled", false);
    	      $("span#matches").text("(" + n + " matches)");
    	    }).focus();
    },
    setupContextMenu: function(layertreeNode) {
    	layertreeNode.contextmenu({
    	      delegate: "span.fancytree-title",
    	      menu: [
    	          {title: "Edit", cmd: "edit", uiIcon: "ui-icon-pencil", disabled: false },
    	          ],
    	      beforeOpen: function(event, ui) {
    	        var node = $.ui.fancytree.getNode(ui.target);
    	        node.setActive();
    	      },
    	      select: function(event, ui) {
    	        var node = $.ui.fancytree.getNode(ui.target);
    	        window.open(node.data.href, '_edit');
    	      }
    	    });
    },
    createTree: function() {
        if (_.isUndefined(app.tree) && !_.isUndefined(app.treeData)){
            var layertreeNode = this.$el.find("#layertree");
            var context = this;
            var mytree = layertreeNode.fancytree({
                extensions: ['persist', 'filter', 'transparency_slider'],
                source: app.treeData,
                filter: {
                    autoApply: true,  // Re-apply last filter if lazy data is loaded
                    counter: true,  // Show a badge with number of matching child nodes near parent icons
                    fuzzy: false,  // Match single characters in order, e.g. 'fb' will match 'FooBar'
                    hideExpandedCounter: true,  // Hide counter badge, when parent is expanded
                    highlight: true,  // Highlight matches by wrapping inside <mark> tags
                    mode: "hide",  // Hide unmatched nodes (pass "dimm" to gray out unmatched nodes)
                    autoExpand: true
                  },
                checkbox: true,
                icon: function(event, data) {
                	  if( !data.node.isFolder() ) { 
                		  return context.getTreeIcon(data.node.data.type); 
                	  }
                	},
                expand: function(event, data){
                	app.vent.trigger('tree:expanded', data.node);
                },
                lazyLoad: function(event, data){
                    data.result = $.ajax({
                      url: data.node.data.childNodesUrl,
                      dataType: "json",
                      success: $.proxy(function(data) {
                          if (!_.isUndefined(data) && data.length > 0){
                              $.each(data, function(index, datum){
                            	  app.vent.trigger('treeNode:loaded', datum);
                                  app.vent.trigger('mapNode:create', datum);
                                  if (!_.isUndefined(datum.children)){
                                      $.each(datum.children, function(index, child){
                                          app.vent.trigger('mapNode:create', child);
                                      });
                                  }
                              });
                          }
                      }, this),
                    });
                },
                select: function(event, data) {
                    // new simpler way
                    if (_.isUndefined(data.node.mapView)){
                        app.vent.trigger('mapNode:create', data.node);
                    } else {
                        data.node.mapView.render(data.node.selected);
                    }
                  },
                  persist: {
                      cookieDelimiter: "~",    // character used to join key strings
                      cookiePrefix: undefined, // 'fancytree-<treeId>-' by default
                      cookie: { // settings passed to js.cookie plugin
                        raw: false,
                        expires: "",
                        path: "",
                        domain: "",
                        secure: false
                      },
                      expandLazy: false, // true: recursively expand and load lazy nodes
                      overrideSource: true,  // true: cookie takes precedence over `source` data attributes.
                      store: "cookie",     // 'cookie': use cookie, 'local': use localStore, 'session': use sessionStore
                      types: "active expanded focus selected"  // which status types to store
                    }
            });
            app.tree = layertreeNode.fancytree("getTree");
            this.setupContextMenu(layertreeNode);
            this.storedParent = this.$el.parent();
            app.vent.trigger('tree:loaded');
        }
    }

    
});

