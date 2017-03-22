//__BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the
//Administrator of the National Aeronautics and Space Administration.
//All rights reserved.

//The xGDS platform is licensed under the Apache License, Version 2.0
//(the "License"); you may not use this file except in compliance with the License.
//You may obtain a copy of the License at
//http://www.apache.org/licenses/LICENSE-2.0.

//Unless required by applicable law or agreed to in writing, software distributed
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
//CONDITIONS OF ANY KIND, either express or implied. See the License for the
//specific language governing permissions and limitations under the License.
//__END_LICENSE__


/*
 ** Override the TemplateCache function responsible for
 ** rendering templates so that it will use Handlebars.
 */
Marionette.TemplateCache.prototype.compileTemplate = function(
		rawTemplate, options) {
	return Handlebars.compile(rawTemplate, options);
};



//A view that iterates over a Backbone.Collection
//and renders an individual child view for each model.
//This version supports having a custom template just like Marionette.View
//You should define what element to use for the children with childrenEl property
Marionette.TemplateCollectionView = Marionette.CollectionView.extend({

	// You might need to override this if you've overridden attachHtml
	attachBuffer(collectionView, buffer) {
		collectionView.$childrenEl.append(buffer);
	},


	serializeModel: function serializeModel() {
		if (!this.model) {
			return {};
		}
		return _.clone(this.model.attributes);
	},

//	Serialize the view's model *or* collection, if
//	it exists, for the template
	serializeData() {
		if (!this.model && !this.collection) {
			return {};
		}

//		If we have a model, we serialize that
		if (this.model) {
			return this.serializeModel();
		}

//		Otherwise, we serialize the collection,
//		making it available under the `items` property
		return {
			items: this.serializeCollection()
		};
	},

//	Mix in template context methods. Looks for a
//	`templateContext` attribute, which can either be an
//	object literal, or a function that returns an object
//	literal. All methods and attributes from this object
//	are copies to the object passed in.
	mixinTemplateContext(target) {
		if (target === undefined){
			target = {};
		}
		const templateContext = _.result(this, 'templateContext');
		return _.extend(target, templateContext);
	},

//	Internal method to render the template with the serialized data
//	and template context via the `Marionette.Renderer` object.
	_renderTemplate: function _renderTemplate() {
		var template = this.template;
		var data = this.mixinTemplateContext(this.serializeData());
		var html = Marionette.Renderer.render(template, data, this);
		this.$el.html(html);
		if (!_.isUndefined(this.childrenEl)) {
			this.$childrenEl = this.$el.find(this.childrenEl);
		} else {
			this.$childreneEl = this.$el;
		}
	},
	
	_reInitRegions: function _reInitRegions() {
	    _.invoke(this._regions, 'reset');
	  },

	// Render children views. Override this method to provide your own implementation of a
	// render function for the collection view.
	render() {
		if (this._isDestroyed) {
			return this;
		}
		this.triggerMethod('before:render', this);
		if (this._isRendered) {
			this._reInitRegions();
		}
		this._renderTemplate();
		this._renderChildren();
		this.bindUIElements();
		this._isRendered = true;
		this.triggerMethod('render', this);
		return this;
	},



	// Internal method. Separated so that CompositeView can append to the childViewContainer
	// if necessary
	_appendReorderedChildren(children) {
		this.$childrenEl.append(children);
	},


	// You might need to override this if you've overridden attachHtml
	attachBuffer(collectionView, buffer) {
		collectionView.$childrenEl.append(buffer);
	},


	// Internal method. Check whether we need to insert the view into the correct position.
	_insertBefore(childView, index) {
		var currentView;
		const findPosition = this.sort && (index < this.children.length - 1);
		if (findPosition) {
			// Find the view after this one
			currentView = this.children.find(function(view){
				return view._index === index + 1;
			});
		}

		if (currentView) {
			currentView.$childrenEl.before(childView.el);
			return true;
		}

		return false;
	},

	// Internal method. Append a view to the end of the $el
	_insertAfter(childView) {
		this.$childrenEl.append(childView.el);
	},


});

(function( xGDS, $, _, Backbone, Marionette ) {
	xGDS.toSiteFrame =  function(coords, alternateCrs) {
		if (alternateCrs.type == 'roversw' &&
				alternateCrs.properties.projection == 'utm') {
			var utmcoords = [null, null, null];
			LLtoUTM(coords[1], coords[0], utmcoords, alternateCrs.properties.zone);
			var x = utmcoords[1] - alternateCrs.properties.originNorthing;
			var y = utmcoords[0] - alternateCrs.properties.originEasting;
			return [x, y]; // northing, easting for roversw
		} else if (alternateCrs.type == 'proj4') {
			var proj = proj4(alternateCrs.properties.projection);
			return proj.forward(coords);
		} else {
			console.warn('Alternate CRS unknown');
			return coords;
		}
	};

	xGDS.toLngLat = function(coords, alternateCrs) {
		if (alternateCrs.type == 'roversw' &&
				alternateCrs.properties.projection == 'utm') {
			var oeasting = alternateCrs.properties.originEasting;
			var onorthing = alternateCrs.properties.originNorthing;
			var utmEasting = parseFloat(coords[1]) + alternateCrs.properties.originEasting;
			var utmNorthing = parseFloat(coords[0]) + alternateCrs.properties.originNorthing;
			var lonLat = {};
			UTMtoLL(utmNorthing, utmEasting,
					alternateCrs.properties.zone,
					lonLat);
			return [lonLat.lon, lonLat.lat];
		} else if (alternateCrs.type == 'proj4') {
			var proj = proj4(alternateCrs.properties.projection);
			return proj.inverseTransform(coords);
		} else {
			console.warn('Alternate CRS unknown');
			return coords;
		}
	};

	xGDS.Actions = { 
		undoStack: new Array(),
		redoStack: new Array(),
		currentState: undefined,
		enabled: true,
		_disableCount: 0,
		_inAction: false,
		_enterAction: function() {
			this._inAction = true;
		},
		_exitAction: function() {
			this._inAction = false;
		},
		disable: function() {
			if (this._inAction)
				return;
			this._enterAction();
			this._disableCount += 1;
			this.enabled = false;
			this._exitAction();
		},
		enable: function() {
			if (this._inAction)
				return;
			this._enterAction();
			this._disableCount -= 1;
			if (this._disableCount <= 0) {
				this.enabled = true;
				this._disableCount = 0;
			}
			this._exitAction();
		},
		undoEmpty: function() {
			return this.undoStack.length == 0;
		},
		redoEmpty: function() {
			return this.redoStack.length == 0;
		},
		setInitial: function(force) {
			if (this.currentState == undefined || force !== undefined && force) {
				this.currentState = JSON.stringify(app.getSerializableObject().toJSON());
			}
		},
		resetCurrent: function() {
			if (this._inAction)
				return;
			this._enterAction();
			this.setInitial(true);
			this._exitAction();
		},
		action: function() {
			if (this._inAction)
				return;
			if (!this.enabled)
			return;
			if (this.currentState == undefined)
				return;
			this.disable();
			this._enterAction();
			var sObject = app.getSerializableObject().toJSON();
			var sObjectString = JSON.stringify(sObject);
			if (this.currentState == sObjectString) {
				// unchanged from current state
			} else {
				this.undoStack.push(this.currentState);
				this.currentState = sObjectString;
				this.redoStack = new Array();
				app.vent.trigger('undoNotEmpty');
				app.vent.trigger('redoEmpty');
				app.vent.trigger('actionOcurred');
			}
			this._exitAction();
			this.enable();
		},
		undo: function() {
			if (this._inAction)
				return;
			if (!this.enabled)
				return;
			this.disable();
			this._enterAction();
			var sObjectString = this.undoStack.pop();
			var sObject = JSON.parse(sObjectString);
			if (sObject == undefined) {
				app.vent.trigger('undoEmpty');
			} else {
				this.redoStack.push(this.currentState);
				this.currentState = sObjectString;
				app.updateSerializableObject(sObject);
				app.vent.trigger('redoNotEmpty');
				if (this.undoStack.length == 0)
					app.vent.trigger('undoEmpty');
			}
			this._exitAction();
			this.enable();
		},
		redo: function() {
			if (this._inAction)
				return;
			if (!this.enabled)
				return;
			this.disable();
			this._enterAction();
			var sObjectString = this.redoStack.pop();
			var sObject = JSON.parse(sObjectString);
			if (sObject == undefined) {
				app.vent.trigger('redoEmpty');
			} else {
				this.undoStack.push(this.currentState);
				this.currentState = sObjectString;
				app.updateSerializableObject(sObject);
				app.vent.trigger('undoNotEmpty');
				if (this.redoStack.length == 0)
					app.vent.trigger('redoEmpty');
			}
			this._exitAction();
			this.enable();
		}
	}
}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));

xGDS.TabNavView = Marionette.View.extend({
    template: '#template-tabnav',
    regions: {
        tabTarget: '#tab-target',
        tabContent: '#tab-content'
    },
    events: {
        'click ul.tab-nav li': 'clickSelectTab'
    },

    initialize: function() {
        this.layersView = null;
        this.on('tabSelected', this.setTab);
        var context = this;
        this.listenTo(app.vent, 'setTabRequested', function(tabId) {
            context.setTab(tabId);
        });
        $('#tabs-gridstack-item').on('resizestop', function(event, ui) {
        	setTimeout(function(){
        		context.handleGridstackResize();
        	}, 105);
        });
    },

    handleGridstackResize: function() {
    	if (!_.isUndefined(app.State.tabsContainer)){
    		var tabsDiv = this.$el.parent();
    		var grandpa = this.$el.parent().parent();
    		tabsDiv.width(grandpa.width());
        }
    },
    

    clickSelectTab: function(event) {
        var newmode = $(event.target).parents('li').data('target');
        this.trigger('tabSelected', newmode);
    },

    setTab: function(tabId) {
        var oldTab = app.currentTab;
        app.currentTab = tabId;
        if (oldTab == tabId){
            return;
        }
        var $tabList = this.$el.find('ul.tab-nav li');
        $tabList.each(function() {
            li = $(this);
            if (li.data('target') === tabId) {
                li.addClass('active');
            } else {
                li.removeClass('active');
            }
        });
        
        var view = undefined;
        if (tabId == 'layers'){
        	// we reuse the layers view
            if (_.isNull(this.layersView)){
            	this.layersView =  this.constructNewViewFromId(tabId);
            }
            view = this.layersView;
        } else {
        	if (oldTab == 'layers'){
            	this.detachChildView('tabContent');
            }
        	view = this.constructNewViewFromId(tabId);
        }
        if (view == undefined){
    		return;
    	}
        app.currentTabView = view;
    	this.showChildView('tabContent', view);
        
        app.vent.trigger('tab:change', tabId);
    },
    getModel: function() {
    	//override this
    	return null;
    },
    constructNewViewFromId: function(tabId){
    	var viewClass = this.viewMap[tabId];
        if (! viewClass) { 
        	return undefined; 
        }
        var view = new viewClass({
            model: this.getModel()
        });
        return view;
    }

});

xGDS.RootView = Marionette.View.extend({
	template: '#application_contents',
	onAttach: function() {
		var pageTopHeight = $('#page-top').outerHeight();
		var pageElement = $('#page');
		var pageContentElement = $('#page-content');
		pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
		$(window).bind('resize', function() {
			pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
		});
	}
});

xGDS.makeExpandable = function(view, expandClass) {
    /*
     * Call this on a view to indicate it is a expandable item in the three-column layout.
     * When the view's 'expand' event is triggered, it will display it's chevron and trigger
     * the global 'viewExpanded' event.  On recieving a global 'viewExpoanded' event with an
     * expandClass that matches its own, the view will remove it's chevron.
     */
    if (app.currentTab != app.expandableTab) {
        // memory leak work around
        return;
    }
    var expandable = {
        expand: function(childView) {
            this.trigger('expand', childView);
        },
        _expand: function() {
            var expandClass = this.options.expandClass;
            this.expanded = true;
            this._addIcon();
            app.vent.trigger('viewExpanded', this, expandClass);
            if (!_.isUndefined(this.onExpand) && _.isFunction(this.onExpand)) {
                this.onExpand();
            }
        },
        unexpand: function() {
            this.expanded = false;
            this.$el.find('i').removeClass('fa-play');
        },
        onExpandOther: function(target, expandClass) {
            if (this.options.expandClass === expandClass && this != target && target.isClosed != true) {
                this.unexpand();
            }
        },
        _ensureIcon: function() {
            if (view.$el.find('i').length == 0) {
                view.$el.append('<i/>');
            }
        },
        _restoreIcon: function() {
            if (this.expanded) {
                this._addIcon();
            }
        },
        _addIcon: function() {
            this._ensureIcon();
            this.$el.find('i').addClass('fa-play');
        },
        onClose: function() {
            this.stopListening();
        }
    };
    view = _.defaults(view, expandable);
    view.options = _.defaults(view.options, {expandClass: expandClass});
    view.listenTo(app.vent, 'viewExpanded', view.onExpandOther, view);
    view.on('expand', view._expand, view);
    view.on('render', view._restoreIcon, view);
};