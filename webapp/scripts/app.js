var geeklistMon = angular.module("geeklistMon", ["highcharts-ng"]);

geeklistMon.controller('GeeklistCtrl', function($scope, $http){
	var couchDbUrl = 'http://www.hoffy.no:5984/geeklistmon/';
	
	//Load list of lists
	$http.get(couchDbUrl + "_design/geeklists/_view/geeklists?include_docs=true").then(function(response){
		var lists = [];

		response.data.rows.forEach(function(value){
			lists.push(value);	
		});

		lists.sort(function(a, b){
			if(a.key > b.key){
				return(1);
			}else{
				return(-1);	
			}
		});

		$scope.geeklists = lists;
	});

	var drilldownSeries = [];
	var levels = [];
	var levelLabels = [];
	var seriesColors = [];
	
	$scope.updateTable = function(){
		console.log("Ran updateTable");

		if(typeof $scope.geeklistId != undefined){
			console.log("id="+$scope.geeklistId);
			
			$scope.mechanicsChartConfig.loading =  true;
			$scope.categoriesChartConfig.loading =  true;
			$scope.boardgames = [];
			$scope.designers = [];
			$scope.publishers = [];
			
			var urlGeeklist = couchDbUrl + "_design/geeklist/_view/geeklist?reduce=false&include_docs=true&key=\"" + $scope.geeklistId + "\"";
			
			$http.get(urlGeeklist).then(function(response){
				var startTime = Date.now();
				var boardgames = [];
				
				angular.forEach(response.data.rows, function(value, key){
					bg = value.doc;
					bg.maxplayers = parseInt(bg.maxplayers, 10);
					bg.playingtime = parseInt(bg.playingtime, 10);
					bg.crets = Date.parse(bg.crets);	
					
					boardgames.push(bg)
				});

				var designers = [];
				var publishers = [];
				
				boardgames.forEach(function(boardgame){
					//Build filtering values for designers
					boardgame.boardgamedesigner.forEach(function(d){
						if(designers.indexOf(d.name) == -1){
							designers.push(d.name); 	
						}
					});
					
					//Build filtering values for publishers
					boardgame.boardgamepublisher.forEach(function(p){
						if(publishers.indexOf(p.name) === -1){
							publishers.push(p.name); 	
						}
					});
				});
				
				$scope.boardgames = boardgames;
				$scope.designers = designers.sort();
				$scope.publishers = publishers.sort();
				
				$scope.statsDates = [];
				$scope.selectedBoardgame = null;
				
				console.log("Fetched boardgames from db in" + (Date.now() - startTime));
				
				return(true);
			}).then(
				function(){
					var startTime = Date.now()
					decomposeList($scope.boardgames);
					console.log("Ran decompose in " + (Date.now() - startTime));
					
					return true;
				}
			).then(	
				function(){
					console.log("This would fetch geekliststats");
					var startTime = Date.now()
					var urlGeeklistStat = couchDbUrl + "_design/geeklist/_view/geeklist?include_docs=true&key=\"" + $scope.geeklistId + "\"";
					console.log("Fetched geekliststat in " + (Date.now() - startTime));
				}
			);

		}
	};

	function decomposeListConditional(boardgames, property, given){
		console.log("Run decompose conditional" + given.join(">"));
		items = [];
		series = [];
		
		if(boardgames != undefined){
			//First filter out games that have all the things we are drilling down on.
			var bgList = boardgames.filter(
											function(boardgame){
												num = 0; 
												given.forEach(
													function(p){
														b =boardgame[property].find(
															function(pr){
																return(pr.id === p);
															}
														);
														if(b != undefined){
															num++;
														}
													}); 
												
												return(num == given.length);
											});
			bgList.forEach(function(boardgame){
				//TODO: Add item "no other mechanics/categories" to see the ones that only have the drilldown categories.
				boardgame[property].forEach(function(i){
					if(given.indexOf(i.id) === -1){
						item = items.find(function(j){ return(j.id === i.id);});

						if(item === undefined){
							item = {'id': i.id, 'name': i.name, 'cnt': 0};
							items[items.length] = item;
						}	

						item.cnt += 1;
					}else{
						
					}
				});
			});

			items.forEach(function(i){
				series.push({name: i.name, y: i.cnt, drilldown: i.id, id: i.id});
			});
			
			series.sort(function(a,b){
										if(a.y > b.y){
											return(-1)
										}else{
											return(1)
										}
								})	
		}
		return(series);
	}

	function decomposeList(boardgames){
		console.log("Run listStats");
		mechanics = [];
		categories = [];
		
		//if($scope.boardgames != undefined){
		if(boardgames != undefined){
			boardgames.forEach(function(boardgame){
				boardgame.boardgamemechanic.forEach(function(m){
					mechanic = mechanics.find(function(mech){ return(mech.id === m.id);});
					if(mechanic === undefined){
						mechanic = {'id': m.id, 'name': m.name, 'cnt': 0};
						mechanics[mechanics.length] = mechanic;
					}	

					mechanic.cnt += 1;
				});

				boardgame.boardgamecategory.forEach(function(c){
					category = categories.find(function(cat){ return(cat.id === c.id);});
					if(category === undefined){
						category = {'id': c.id, 'name': c.name, 'cnt': 0};
						categories[categories.length] = category;
					}

					category.cnt += 1;
				});
			});
			$scope.mechanics = mechanics;
			$scope.categories = categories;
			
			//Plot
			s = [];
			mechanics.forEach(function(m){
				//s.push([m.name, m.cnt]);
				s.push({name: m.name, y: m.cnt, drilldown: m.id, id: m.id});
			});
			
		  $scope.mechanicsChartConfig.series =  [{name: "Mechanics Breakdown", data:s.sort(
											function(a,b){
												if(a.y > b.y){
													return(-1)
												}else{
													return(1)
												}
											})
										}];

			c = [];
			categories.forEach(function(cat){
				//c.push([cat.name, cat.cnt]);
				c.push({name: cat.name, y: cat.cnt, drilldown: true});
			});
			
			$scope.categoriesChartConfig.series =  [{name: "Category Breakdown", data:c.sort(function(a,b){
					if(a.y > b.y){
						return(-1)
					}else{
						return(1)
					}
				})
			}];

			$scope.mechanicsChartConfig.loading =  false;
			$scope.categoriesChartConfig.loading =  false;
		}
	};

	function listDrilldown(conf, e){
		if(levels.indexOf(e.point.id) === -1){
			levels.push(e.point.id);
			levelLabels.push(e.point.name);
		}
		
		conf.options.drilldown.series = [{id: e.point.id, name: "Given "+levelLabels.join(">"), data: decomposeListConditional($scope.boardgames, "boardgamemechanic", levels)}];
	}

	var dateComp = function(a, b){
			if(Date.parse(a) > Date.parse(b)){
				return(-1);
			}else if(Date.parse(a) < Date.parse(b)){
				return(1);
			}else{
				return(0);
			}
	}

	$scope.boardgameChartConfig = {
		options: {
			chart: {
				type: 'areaspline'
			},
			plotOptions: {
				series: {
					stacking: ''
				}
			}
		},
		series: [],
		title: {
			text: 'not loaded'
		},
		credits: {
			enabled: true
		},
		loading: true,
		size: {}
	};

	$scope.mechanicsChartConfig = {
		options: {
			chart: {
				type: 'pie',
				events: {
					drilldown: function(e){listDrilldown(this, e);},
					drillup: function(e){levels.pop(); levelLabels.pop();}
				}
			}
		},
		title: {
			text: 'Mechanic breakdown'
		},
		size: {},
		drilldown: {
			drillUpButton: {
				relativeTo: 'spacingBox',
	position: {
	y: -200,
	x: 0
	}
			},
			series: [{}]
		}
	};

	$scope.categoriesChartConfig = {
		options: {
			chart: {
				type: 'pie'
			},
			plotOptions: {
				series: {
					stacking: ''
				}
			}
		},
		series: [],
		title: {
			text: 'Category breakdown'
		},
		credits: {
			enabled: true
		},
		loading: false,
		size: {}
	};

	$scope.statsDates = []
	$scope.selectedBoardgame = null;
	$scope.selectedStatDate = "";

	$scope.updateGraph = function(){
		if($scope.selectedBoardgame != null){
			$scope.boardgameChartConfig.title.text = $scope.selectedBoardgame.name;
			
			var geeklist = $scope.selectedBoardgame.geeklists.find(function(e) {return e.id === $scope.geeklistId});	
			
			if($scope.graphtype == "hist" && $scope.selectedStatDate != ""){
				var series = [];
				var stat =  geeklist.stats.find(function(stat){return(stat.date === $scope.selectedStatDate)});
				
				if(stat != null){
					stat.obs.forEach(function(o){series.push([parseInt(o.pos, 10), parseInt(o.cnt, 10)])});
				}
				
				$scope.boardgameChartConfig.loading = false;	
				$scope.boardgameChartConfig.series = [{"name": "hist", "data": series, type: "column"}];
			}else if($scope.graphtype == "ts"){
				var series = [];

				geeklist.stats.forEach(function(stat){
					series.push([stat.date, stat.cnt]);	
					});

				series.sort(function(a, b){
					if(Date.parse(a[0]) > Date.parse(b[0])){
						return(-1);
					}else if(Date.parse(a[0]) < Date.parse(b[0])){
						return(1);
					}else{
						return(0);
					}		
				}).reverse();
				
				$scope.boardgameChartConfig.loading = false;	
				$scope.boardgameChartConfig.series = [{"name": "ts", "data": series}];
			}
		}
	}	

	function createPalette(colorCount) {
		var newPalette = [];
		var hueStep = Math.floor ( 330 / colorCount ) ;
		var hue = 0 ;
		var saturation = 95 ;
		var luminosity =  55 ;
		var greenJump  = false ;
		for ( var colorIndex=0; colorIndex < colorCount; colorIndex++ ) {
			saturation = (colorIndex & 1) ? 90 : 65;
			luminosity = (colorIndex & 1) ? 80 : 55;
			newPalette.push( hslToRgbString (hue ,saturation, luminosity ));
			hue += hueStep ;
			if (!greenJump && hue >100) {
				hue+=30;
				greenJump = true;
			}
		} 
		return newPalette ;   
	}


	$scope.updateStatsDateDropdown = function(boardgame){
		$scope.displaySection(2);
		
		var statsKeys = [];
		var geeklist = boardgame.geeklists.find(function(e){ return e.id === $scope.geeklistId});
		geeklist.stats.forEach(function(stat){statsKeys.push(stat.date);});
		statsKeys.sort(dateComp);

		$scope.statsDates = statsKeys;
		$scope.selectedBoardgame = boardgame;	
		$scope.updateGraph();
	}

	$scope.reflow = function () {
	    $scope.$broadcast('highchartsng.reflow');
	};

	$scope.$broadcast('highchartsng.reflow');
	
	//Default sorting
	$scope.predicate = 'crets';
	$scope.reverse = true;
	
	$scope.$watch('geeklistId', function(newVal, oldVal){
		if(newVal != oldVal){
			$scope.updateTable();
		}
	});

	$scope.$watch('statsDate', function(newVal, oldVal){
		if($scope.graphtype == "hist"){
			if(newVal != oldVal){
				$scope.selectedStatDate = newVal;
				$scope.updateGraph();
			}
		}else if($scope.graphtype == "ts"){
			
		}
	});

	$scope.$watch('graphtype', function(newVal, oldVal){
		$scope.updateGraph();	
	});

	$scope.ignoreNullComparator = function (actual, expected){
		if (expected == null || expected == ""){
			return(true);
		}else{
			var text = ('' + actual).toLowerCase();
			return(('' + expected).toLowerCase().indexOf(text) > -1);
		}
	};

	$scope.greaterThan = function(actual, expected){
		if(parseInt(expected, 10) == expected){
			return(parseInt(actual, 10) >= parseInt(expected,10));
		}else{
			return(true);
		}
	}

	$scope.lessThan = function(actual, expected){
		if(parseInt(expected, 10) == expected){
			return(parseInt(actual, 10) <= parseInt(expected,10));
		}else{
			return(true);
		}
	}
	
	$scope.selection = "1";	

	$scope.displaySection = function(idx){
		$scope.selection = ""+idx;
	}

	$scope.showFilters = function(){
		return $scope.selection === "1"
	}
});
//});


