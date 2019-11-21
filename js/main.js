//self-induced function called when page is loaded
(function(){
    
    //these puesdo-global variables are created so their contents can be called throughout several functions without redundantly creating the variable in each function    
    var attrArray = ["Cost Index", "Grocery Cost Index", "Housing Cost Index", "Utilities Cost Index", "Transportation Cost Index", "Miscellaneous Cost Index"];
    
    var expressed = attrArray[0]; 
    
    var chartWidth = window.innerWidth * 0.425,
            chartHeight = 450,
            leftPadding = 25,
            rightPadding = 2,
            topBottomPadding = 3,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
    var yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 200]);

    window.onload = setMap();

    //this function creates the map svg and sets many of the basic attributes
    //the projection of the map is also set here
    //the csv and topojson datasets are loaded into the page for user using the callback function
    function setMap(){
        
        var width = window.innerWidth * 0.5,
            height = 500;
    
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);
                
    
        var projection = d3.geoAlbers()
            .scale(850)
            .translate([width/2, height/2]);
    
        var path = d3.geoPath()
            .projection(projection);
    
        d3.queue()
            .defer(d3.csv, "data/data.csv")
            .defer(d3.json, "data/countries.topojson")
            .defer(d3.json, "data/states.topojson")
            .await(callback);
    
        function callback(error, csvData, countries, states){
        
            setGraticule(map, path);
            
            var countriesData = topojson.feature(countries, countries.objects.countries);
        
            var statesData = topojson.feature(states, states.objects.states).features;
        
            statesData = joinData(statesData, csvData);
           
            var colorScale = createColorScale(csvData);
            setEnumerationUnits(statesData, countriesData, map, path, colorScale);
            
            setChart(csvData, colorScale);
            
            createDropdown(csvData);
            
            createText();
        
        };
        
    };
    
    //this function is called to create the graticule on the map that will show the curvature of the earth (and the projection), subtly     
    function setGraticule(map, path){
    
        var graticule = d3.geoGraticule()
            .step([10, 10]);
        
        var gratBackground = map.append("path")
            .datum(graticule.outline())
            .attr("class", "gratBackground")
            .attr("d", path);
        
        var gratLines = map.selectAll(".gratLines")
            .data(graticule.lines())
            .enter()
            .append("path")
            .attr("class", "gratLines")
            .attr("d", path);
        return;
    };
    
    //this function joins the csv and topojson data (based on the name attribute)
    //the csv data values become attributes of the topojson elements (states)
    function joinData(statesData, csvData){
       for (var i=0; i<csvData.length; i++) {
            var csvState = csvData[i];
            var csvKey = csvState.name;
            
            for (var a=0; a<statesData.length; a++) {
                var geojsonProps = statesData[a].properties;
                var geojsonKey = geojsonProps.name;
                
                if (geojsonKey == csvKey){
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvState[attr]);
                        
                        geojsonProps[attr] = val;
                    });
                };
            };
           
        }; 
        
        return statesData;
    };
    
    //this function takes the information from the topojson files and draws their elements onto the map
    //first the countries (contextual information only) layer is drawn, then the state layer
    //event listeners are added to the state layer. these listener call functions depending on the action performed by the user
    //highlight when hovering over a state
    //dehightlight when ceasing to hover over a state
    //moveLabel moves the label to follow the movement of the cursor over the state layer
    //a desc tag is placed here too to hold the default style for the state layer
    function setEnumerationUnits(statesData, countriesData, map, path, colorScale){
        var countriesMap = map.append("path")
            .datum(countriesData)
            .attr("class", "countries")
            .attr("d", path);
        
        var statesMap = map.selectAll(".statesMap")
            .data(statesData)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "statesMap " + d.properties.name;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            })
            .on("mouseover", function(d){
                highlight(d.properties);
            })
            .on("mouseout", function(d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
        
        var desc = statesMap.append("desc")
            .text('{"stroke": "#FFF", "stroke-width": "0.25px"}');
        
        return;
    }; 
    
    //this function creates the class breaks and assigns a color to the state enumeration units or bars depending on their class
    //this color scale was created using Color Brewer
    //the data is broken into 5 classes, using the scaleThreshold (or natural breaks) method
    function createColorScale(data){
        var colorClasses = [
            "#9ECAE1",
            "#6BAED6",
            "#4292C6",
            "#2171B5",
            "#084594"
        ];
        
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);
        
        var domainArray = [];
        
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };
            
        var clusters = ss.ckmeans(domainArray, 5);
        
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        
        domainArray.shift();
        
        colorScale.domain(domainArray);
        
        return colorScale;
    };
    
    //this function is called to find which color is to correlate with each state or bar, depending on its class
    //this function checks for invalid values and returns a grey color if any are found
    function choropleth(props, colorScale){
        var val = parseFloat(props[expressed]);
        
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        };
    };
    
    //this function serves to create each aspect of the chart that coordinates with the map data
    //the svg element is first created and appended to the body of the document
    //the height, width, and location are set by calling the values of the 'psuedo-global' variables
    //a chart title is created and placed within the svg
    //the bar rectangle elements are created and sorted using the csv data that was attached to each
    //event listeners are created for the bars. highlight, dehighlight and moveLabel are each called based on the position of the cursor over an element (or as it moves away from one)
    //the desc tag is created to hold the default style of the bars
    //the y axis is created in order to give context to the bar heights
    //a frame is created to surround the chart
    function setChart(csvData, colorScale){        
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
                
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        var xTitle = (chartWidth/2)-80;
        
        var chartTitle = chart.append("text")
            .attr("x", xTitle)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed + " by State");
        
        var bar = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a,b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.name;
            })
            .attr("width", chartInnerWidth/csvData.length-1)
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);
        
        var desc = bar.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');
        
        var yAxis = d3.axisLeft()
            .scale(yScale);
        
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);
        
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
     
        updateChart(bar, csvData.length, colorScale);  
    };
    
    //this function creates the dropdown list that allows users to select an index type
    //each attribute option is listed in the dropdown
    function createDropdown(csvData){
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
               
                changeAttribute(this.value, csvData)
            });
        
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");
        
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){
                return d 
            })
            .text(function(d){
                return d
            });
    };
    
    //this function is called when a different index is chosen from the dropdown list
    //this function calls to update create a new color scale based on the new class distribution of the attribute
    //this color is then applied to the states and bars
    function changeAttribute(attribute, csvData){
        expressed = attribute;
        
        var colorScale = createColorScale(csvData);
        
        var states = d3.selectAll(".statesMap")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });
        
        var bar = d3.selectAll(".bar")
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            })
            .transition()
            .delay(function(d, i){
                return i * 20
            })
            .duration(500);
            
        updateChart(bar, csvData.length, colorScale);
        
    };
    
    //this function is called when by changeAttribute when a different type of index is chosen from the dropdown list
    //this is used specifically to update the color and height of each bar
    function updateChart(bar, n, colorScale){  
        bar.attr("x", function(d, i){
                return i * (chartInnerWidth/n)+leftPadding;
            })
            .attr("height", function(d, i){
                return 450 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) - topBottomPadding;
            })
            .style("fill", function(d){
                    return choropleth(d, colorScale)
            });
        
    };
    
    //this function changes the outline of the state or bar the user hovers their cursor over
    //the stroke style is changes to a bright yellow
    function highlight(props){
        var selected = d3.selectAll("." + props.name)
            .style("stroke", "#FED976")
            .style("stroke-width", "2");
        setLabel(props);
    };
    
    //this function resets the outline of each state and bar after the cursor ceases to hover over the element
    //it uses the desc tag created for map and chart elements to track their default styles
    function dehighlight(props){
        var selected = d3.selectAll("." + props.name)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });
        
        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();
            
            var styleObject = JSON.parse(styleText);
            
            return styleObject[styleName];
        };
        
        d3.select(".infoLabel")
            .remove()
    };
    
    //this function creates the label and its contents
    //each state name is added to the label. States with two or more words replace the underscore with a space
    function setLabel(props){
        var formatName = props.name.replace(new RegExp("_", "g")," ");
            
        var labelAttribute = "<h1>" + props[expressed] + "</h1><b>" + formatName + "</b>";
        
        var infoLabel = d3.select("body")
            .append("div")
            .attr("class", "infoLabel")
            .attr("id", props.name + "_label")
            .html(labelAttribute);
    };
    
    //this function determines where the label appears when the user is hovering over a state or bar
    //this function attempts to mitigate problems where the label extends off-screen
    function moveLabel() {
        var labelWidth = d3.select(".infoLabel")
            .node()
            .getBoundingClientRect();
        
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 50,
            x2 = d3.event.clientX - labelWidth.width - 10,
            y2 = d3.event.clientY + 25;
        
        var x = d3.event.clientX > window.innerWidth - labelWidth.width - 20 ? x2 : x1;
        
        var y = d3.event.clientY < 50 ? y2 : y1;
        
        d3.select(".infoLabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };
    
    //this function creates the div element
    //the div element contains text directing where users should look for more information
    //I attempted to find a way to create a hyperlink, but couldn't find a working solution to do outside of the html document
    function createText() {  
        var translateText = "translate(" + ((window.innerWidth/2)+70) + ", -40)";
        
        var text = d3.select("body")
            .append("svg")
            .attr("width", chartWidth - 44)
            .attr("height", 100)
            .attr("class", "text")
            .attr("transform", translateText);
            
        var content1 = "For more information about the 2019 Cost of Living Index, visit";
    
        var content2 = "http://worldpopulationreview.com/states/cost-of-living-index-by-state/"
        
        var line1 = text.append("text")
            .attr("y", 10)
            .attr("class", "textContent")
            .text(content1);
        
        var line2 = text.append("text")
            .attr("y", 30)
            .attr("class", "textContent")
            .text(content2);
        
        
        
    };
    
})();