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

;(function($, undefined) {
     "use strict";
     $.ui.fancytree.registerExtension({
         name: "transparency_slider",
         version: "0.0.A",

         /* We overload nodeRenderTitle to apply the slider to each node*/
         nodeRenderTitle: function(ctx, title) {
            var node = ctx.node;
            this._superApply(arguments);

            if (node.data.transparency != undefined)
            {
            	var sliderID =  node.key + '_slider';
            	var sliderHtml = '<div id="' + sliderID + '" class="transparency_slider" style="width:100px;float:right;margin-left: 10px;" value=' + node.data.transparency + '></div>'
                $("span.fancytree-title", node.span).append(' ').append( $(sliderHtml) );
            }
         }
     });
 }(jQuery));

transparencySlidersVisible = false;
persistTransparency = false;

handleTransparencySliderChange = function(event, ui) {
	var newValue = ui.value;
	var node_id = ui.handle.parentElement.id.substring(0, ui.handle.parentElement.id.length - 7);
	var node = app.tree.getNodeByKey(node_id);
	if (node.mapView != undefined) {
		node.mapView.setTransparency(newValue);
	}
	// set the printed value
	var transparencyValueID = '#' + node_id + '_transparencyValue';
	var transparencyValueSpan = $(ui.handle.parentElement.parentElement).find(transparencyValueID);
	$(transparencyValueSpan).html(newValue);
	
	if (!persistTransparency) {
		// set the cookie
		Cookies.set(node_id, {transparency:newValue});
	}
};

saveTransparency = function(event, ui){
	// save the transparency to the server when the slider stops moving
	var newValue = ui.value;
	var node_id = ui.handle.parentElement.id.substring(0, ui.handle.parentElement.id.length - 7);
	var node = app.tree.getNodeByKey(node_id);
	theUrl = '/xgds_map_server/setTransparency/' + node_id + '/' + node.data.type + '/' + newValue;
	$.ajax({
        url: theUrl,
        dataType: "json",
        error: function(data){
        	alert('Problem saving transparency.');
        }
      });
}

toggleTransparencySliders = function() {
	transparencySlidersVisible = !transparencySlidersVisible;
	if (transparencySlidersVisible){
		app.tree.visit(function(node) {
			if (node.data.transparency != undefined){
				var el = $(node.li)
				var value_span = el.find(".transparency_value");
				
				if (value_span.length == 0){
					var slider_div = el.find(".transparency_slider");
					var theSlider = slider_div.slider({value:node.data.transparency,
						   							   slide: handleTransparencySliderChange});
					if (persistTransparency){
						theSlider.on('slidestop', saveTransparency);
					}
					
					// add the value
					var transparencyValueID = node.key + '_transparencyValue';
					var transparencyHtml = '<span style="float:right;" class="transparency_value" id=' + transparencyValueID + '>' + node.data.transparency + '</span>';
					$(slider_div).parent().append($(transparencyHtml));
				} else {
					var slider_div = $(value_span).prev();
					slider_div.toggle();
					value_span.toggle();
				}
			}
			return true;
		})
	} else {
		$(".transparency_value").hide();
		$(".transparency_slider").hide(); //.slider("destroy");
	}
}