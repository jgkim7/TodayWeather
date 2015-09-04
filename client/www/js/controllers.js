angular.module('starter.controllers', [])

    .controller('DashCtrl', function($scope, $ionicScrollDelegate, $cordovaGeolocation, $timeout, $http) {
        $scope.location = "Current Position Searching...";
        $scope.address = "";
        $scope.timeTable = [];
        $scope.currentWeather;
        $scope.currentTime = new Date();

        /**
         * @param day
         * @param hours
         * @returns {*}
         */
        function getDayString(day, hours) {
            if (hours !== 0) {
                return '';
            }
            switch (day) {
                case -2: return '그제';
                case -1: return '어제';
                case 0: return '오늘';
                case 1: return '내일';
                case 2: return '모레';
                default :
                    console.error("Fail to get day string day="+day+" hours="+hours);
                    return '';
            }
        }

        /**
         *
         * @param {number} positionHours
         * @param {number} day
         * @param {number} hours
         * @returns {String}
         */
        function getTimeString(positionHours, day, hours) {
            if (positionHours === hours && day === 0) {
                return '지금';
            }
            return hours+'시';
        }

        /**
         *
         * @param currentHours
         * @returns {number}
         */
        function getPositionHours(currentHours) {
            return Math.floor(currentHours/3)*3;
        }

        /**
         *
         * @param {Number} sky 맑음(1) 구름조금(2) 구름많음(3) 흐림(4) , invalid : -1
         * @param {Number} pty 없음(0) 비(1) 비/눈(2) 눈(3), invalid : -1
         * @param {Number} lgt 없음(0) 있음(1), invalid : -1
         * @param {Boolean} isNight
         */
        function parseSkyState(sky, pty, lgt, isNight) {
            var skyIconName = "";

            if (lgt) {
                return skyIconName = "Lightning";
            }
            switch (pty) {
                case 1:
                    return skyIconName = "Rain";
                case 2:
                    return skyIconName = "Snow"; //Todo need RainWithSnow icon";
                case 3:
                    return skyIconName = "Snow";
            }
            if (isNight) {
               skyIconName = "Moon";
            }
            else {
                skyIconName = "Sun";
            }

            switch (sky) {
                case 1:
                    return skyIconName;
                case 2:
                    return skyIconName += "WithCloud";
                case 3:
                    return skyIconName = "Cloud"; //Todo need new icon
                case 4:
                    return skyIconName = "Cloud";
            }

            return skyIconName;
        }

        /**
         *
         * @param temp
         * @param tmx
         * @param tmn
         * @returns {string}
         */
        function decideTempIcon(temp, tmx, tmn) {
            var tempIconName = "Temp-";
            var max = tmx-tmn;
            var c = temp - tmn;
            var p = c/max*10;

            if (p>9) { tempIconName += "10";
            }
            else if (p>8) { tempIconName += "09";
            }
            else if (p>7) { tempIconName += "08";
            }
            else if (p>6) { tempIconName += "07";
            }
            else if (p>5) { tempIconName += "06";
            }
            else if (p>4) { tempIconName += "05";
            }
            else if (p>3) { tempIconName += "04";
            }
            else if (p>2) { tempIconName += "03";
            }
            else if (p>1) { tempIconName += "02";
            }
            else { tempIconName += "01";
            }

            console.log(temp+" icon="+tempIconName);
            return tempIconName;
        }

        /**
         *
         * @param {Object} currentTownWeather
         * @returns {{}}
         */
        function parseCurrentTownWeather(currentTownWeather) {
            var currentForecast = {};
            var time = parseInt(currentTownWeather.시간.substr(0,2));
            var isNight = time < 7 || time > 18;
            currentForecast.time = parseInt(currentTownWeather.시간.substr(0,2));
            currentForecast.t1h = currentTownWeather.기온;
            currentForecast.sky = parseSkyState(currentForecast.하늘상태, currentTownWeather.강수형태,
                        currentTownWeather.낙뢰, isNight);

            return currentForecast;
        }

        /**
         *
         * @param {String} str
         * @returns {*}
         */
        function convertStringToDate(str) {
            var y = str.substr(0,4),
                m = str.substr(4,2) - 1,
                d = str.substr(6,2);
            var D = new Date(y,m,d);
            return (D.getFullYear() == y && D.getMonth() == m && D.getDate() == d) ? D : undefined;
        }

        /**
         *
         * @param {Date} target
         * @param {Date} current
         * @returns {number}
         */
        function getDiffDays(target, current) {
            if (!target || !current) {
                console.log("target or current is invalid");
                return 0;
            }
            var c = new Date(current.getFullYear(), current.getMonth(), current.getDate());
            return Math.ceil((target-c) / (1000 * 3600 * 24));
        }

        /**
         *
         * @param {Object[]} shortForecastList
         * @param {Date} current
         * @returns {{timeTable: Array, chartTable: Array}}
         */
        function parseShortTownWeather(shortForecastList, current) {
            var timeTable = [];
            var chartTable = [];
            var count = 0;
            var positionHours = getPositionHours(current.getHours());

            shortForecastList.forEach(function (shortForecast) {
                var tempObject = {};
                var time = parseInt(shortForecast.시간.slice(0,-2));
                var diffDays = getDiffDays(convertStringToDate(shortForecast.날짜), current);
                var day = getDayString(diffDays, time);
                var isNight = time < 7 || time > 18;

                tempObject.day = day;
                tempObject.time = getTimeString(positionHours, diffDays, time);
                tempObject.t3h = shortForecast.기온;
                tempObject.sky = parseSkyState(shortForecast.하늘상태, shortForecast.강수형태, shortForecast.낙뢰, isNight);
                tempObject.pop = shortForecast.강수확률;
                tempObject.tempIcon = decideTempIcon(shortForecast.기온, shortForecast.최고기온, shortForecast.최저기온);

                if (shortForecastList.length - count > 8) {
                    chartTable.push({"id": count, "yesterday": tempObject.t3h, "today": 0});
                }

                if (count >= 8) {
                    timeTable.push(tempObject);

                    chartTable[count - 8].today = tempObject.t3h;
                }
                count++;
            });

            return {timeTable: timeTable, chartTable: chartTable};
        }

        /**
         *
         * @param {String} fullAddress 대한민국 천하도 강남시 하늘구 가내동 33-2, 대한민국 서울특별시 라임구 마라동
         * @returns {String[]}
         */
        function splitAddress(fullAddress) {
            var splitAddress = [];
            if (fullAddress && fullAddress.split) {
                splitAddress = fullAddress.split(" ");
            }
            return splitAddress;
        }

        /**
         * It's supporting only korean lang
         * return only city namd and dong name
         * @param {String} fullAddress
         * @returns {string}
         */
        function getShortenAddress(fullAddress) {
            var parsedAddress = splitAddress(fullAddress);
            if (parsedAddress[1].slice(-1) === '도') {
                parsedAddress.splice(0, 2);
            }
            else if (parsedAddress[1].slice(-1) === '시') {
                parsedAddress.splice(0, 1);
            }
            parsedAddress.splice(1, 1);
            parsedAddress.splice(2, 1);

            console.log(parsedAddress.toString());

            return parsedAddress.toString();
        }

        /**
         *
         * @param {String[]} addressArray
         * @param {cbWeatherInfo} callback
         */
        function getWeatherInfo(addressArray, callback) {
            var url = 'town';
            //var url = 'http://todayweather-wizardfactory.rhcloud.com/town';

            if (addressArray[1].slice(-1) === '시') {
                url += '/'+addressArray[1]+'/'+addressArray[2]+'/'+addressArray[3];
            }
            else {
                url += '/'+addressArray[1]+'/'+addressArray[2]+addressArray[3]+'/'+addressArray[4];
            }
            console.log(url);

            $http({method: 'GET', url: url})
                .success(function(data) {
                    console.log(data);
                    callback(undefined, data);
                })
                .error(function(error) {
                    if (!error) {
                        error = new Error("Fail to get weatherInfo");
                    }
                    console.log(error);
                    callback(error);
                });
        }
        /**
         * @callback cbWeatherInfo
         * @param {Error} error
         * @param {Object} data
         */

        /**
         *
         * @param {cbCurrentPosition} callback
         */
        function getCurrentPosition(callback) {
            $cordovaGeolocation.getCurrentPosition().then(function(position) {
                    callback(undefined, position.coords.latitude, position.coords.longitude);

                }, function (error) {
                    console.log(error);
                    callback(error);
                });
        }
        /**
         * @callback cbCurrentPosition
         * @param {Error} error
         * @param {Number} latitude
         * @param {Number} longitude
         */

        /**
         * It's supporting only korean lang
         * @param {Object[]} results
         * @returns {string}
         */
        function findDongAddressFromGoogleGeoCodeResults(results) {
            var dongAdress = "";
            var length = 0;
            results.forEach(function (result) {
                var lastChar = result.formatted_address.slice(-1);
                if (lastChar === '동')  {
                    if(length < result.formatted_address.length) {
                        dongAdress = result.formatted_address;
                        length = result.formatted_address.length;
                    }
                }
            });

            return dongAdress;
        }

        /**
         *
         * @param {Number} lat
         * @param {Number} long
         * @param {cbAddressFromGeolocation} callback
         */
        function getAddressFromGeolocation(lat, long, callback) {
            var url = "http://maps.googleapis.com/maps/api/geocode/json?latlng=" + lat + "," + long +
                        "&sensor=true";
            $http({method: 'GET', url: url}).
                success(function (data, status, headers, config) {
                    if (data.status === 'OK') {
                        var address = findDongAddressFromGoogleGeoCodeResults(data.results);
                        console.log(address);
                        callback(undefined, address);
                    }
                    else {

                        //'ZERO_RESULTS', 'OVER_QUERY_LIMIT', 'REQUEST_DENIED',  'INVALID_REQUEST', 'UNKNOWN_ERROR'
                        callback(new Error(data.status));
                    }
                }).
                error(function (err) {
                    callback(err);
                });
        }
        /**
         * @callback cbAddressFromGeolocation
         * @param {Error} error
         * @param {String} address
         */

        /**
         *
         * @param {Object} current
         * @param {Object} tempObject
         * @returns {*}
         */
        function updateCurrentOnTempTable(current, tempObject) {
            tempObject.t3h = current.t1h;
            tempObject.sky = current.sky;
            tempObject.tempIcon = decideTempIcon(current.t1h, current.tmx, current.tmn);
            return tempObject;
        }

        /**
         *
         * @param {Object} current
         * @param {Object} yesterday
         * @returns {String}
         */
        function makeSummary(current, yesterday) {
            var str = "어제";
            var diffTemp = current.t1h - yesterday.t3h;

            if (diffTemp == 0) {
               return str += "와 동일";
            }

            str += "보다 " + Math.abs(diffTemp);
            if (diffTemp < 0) {
                str += "도 낮음";
            }
            else if (diffTemp > 0) {
                str += "도 높음";
            }
            return str;
        }

        /**
         *
         * @param {cbWeatherData} callback
         */
        function updateWeatherData(callback) {
            getCurrentPosition(function(error, lat, long) {
                if (error) {
                    return callback(error);
                }

                $scope.location = "latitude : " + lat + ", longitude : " + long;
                console.log($scope.location);

                getAddressFromGeolocation(lat, long, function (error, fullAddress) {
                    if (error) {
                        return callback(error);
                    }

                    $scope.address = getShortenAddress(fullAddress);
                    console.log($scope.address);

                    getWeatherInfo(splitAddress(fullAddress), function (error, weatherData) {
                        if (error) {
                            return callback(error);
                        }

                        var currentForecast = parseCurrentTownWeather(weatherData.current);
                        currentForecast.tmx = weatherData.short[0].최고기온;
                        currentForecast.tmn = weatherData.short[0].최저기온;
                        $scope.currentWeather = currentForecast;
                        console.log($scope.currentWeather);

                        var parsedWeather = parseShortTownWeather(weatherData.short, $scope.currentTime);
                        parsedWeather.timeTable[8] = updateCurrentOnTempTable(currentForecast, parsedWeather.timeTable[8]);

                        $scope.currentWeather.summary = makeSummary(currentForecast, parsedWeather.timeTable[0]);
                        $scope.timeTable = parsedWeather.timeTable;
                        $scope.temp = parsedWeather.chartTable;
                        console.log($scope.temp.length);
                        console.log($scope.temp);

                        $ionicScrollDelegate.$getByHandle('chart').scrollTo(375, 0, false);

                        return callback(undefined);
                    });

                });
            });
        }

        /**
         * @callback cbWeatherData
         * @param {Error} error
         */

        $scope.doRefresh = function() {
           updateWeatherData(function(error) {
               if (error) {
                   console.log(error);
                   console.log(error.stack);
               }
               $scope.$broadcast('scroll.refreshComplete');
           });
        };

        $timeout(updateWeatherData(function(error) {
            if (error) {
                console.log(error);
                console.log(error.stack);
            }
        }), 100);

        $timeout(function() {
           $scope.currentTime = new Date();
        }, 1000);
    })

    .controller('ChatsCtrl', function($scope, Chats) {
        // With the new view caching in Ionic, Controllers are only called
        // when they are recreated or on app start, instead of every page change.
        // To listen for when this page is active (for example, to refresh data),
        // listen for the $ionicView.enter event:
        //
        //$scope.$on('$ionicView.enter', function(e) {
        //});

        $scope.chats = Chats.all();
        $scope.remove = function(chat) {
            Chats.remove(chat);
        };
    })

    .controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
        $scope.chat = Chats.get($stateParams.chatId);
    })

    .controller('AccountCtrl', function($scope) {
        $scope.settings = {
            enableFriends: true
        };
    });
