/**
 * Created by Peter on 2016. 3. 17..
 */
var request = require('request');
var async = require('async');
var modelGeocode = require('../../models/worldWeather/modelGeocode.js');
var config = require('../../config/config');


var commandList = ['restart', 'renewGeocodeList'];
var weatherCategory = ['short', 'current'];

function controllerWorldWeather(){
    var self = this;

    self.geocodeList = [];

    self.sendResult = function(req, res){
        if(req.error){
            res.json(req.error);
            return;
        }

        if(req.result){
            res.json(req.result);
            return;
        }

        return;
    };

    self.showUsage = function(req, res, next){
        if(req.result === undefined){
            req.result = {};
        }
        req.result.usage = [
            '/{API version}/{code}/[options]',
            'example 1 > /010000/39.66,116.40',
            'example 2 > /010000/39.66,116.40/short',
            'example 3 > /010000/39.66,116.40/current'
        ];

        next();
    };

    self.checkApiVersion = function(req, res, next){
        var self = this;
        var meta = {};

        meta.method = 'checkApiVersion';
        meta.version = req.params.version;
        req.version = req.params.version;

        log.info(meta);

        // todo: To check all version and make way to alternate route.
        if(req.version !== '010000') {
            log.error('WW> It is not valid version :', req.version);
            req.validVersion = false;
            req.error = 'WW> It is not valid version : ' + req.version;
            next();
        }else{
            log.info('WW > go to next step');
            req.validVersion = true;
            next();
        }
    };

    self.queryWeather = function(req, res, next){
        var meta = {};
        meta.method = 'queryWeather';

        if(!req.validVersion){
            log.error('WW> invalid version : ', req.validVersion);
            return next();
        }

        if(!self.isValidCategory(req)){
            return next();
        }

        if(!self.getCode(req)){
            log.error('WW> There is no geocode');
            return next();
        }

        log.info('geocode : ', req.geocode);

        async.waterfall([
                // 1. load geocode list, if it does not load geocode yet.
                function(callback){
                    if(self.geocodeList.length <= 0){
                        self.loadGeocodeList(function(err){
                            if(err){
                                req.error = err;
                                callback('err_exit');
                            }
                        });
                    }
                    log.info('WW> load geocode');
                    // goto next step
                    callback(null);
                },
                // 2. check geocode if it is in the geocodelist or not.
                function(callback){
                    if(self.checkGeocode(req.geocode)){
                        callback(null);
                    }

                    // Need to send request to add this geocode.
                    log.error('WW> It is the fist request, will collect weather for this geocode :', req.geocode);
                    req.error = new Error('WW> It is the fist request, will collect weather for this geocode');

                    self.requestAddingGeocode(req, function(err){
                        if(err){
                            log.error('WW> fail to reqeust');
                        }
                        callback('err_exit');
                    });
                },
                // 3. get MET data from DB by using geocode.
                function(callback){
                    self.getDataFromMET(req, function(err){
                        log.info('WW> get MET data');

                        // goto next step
                        callback(null);
                    });
                },
                // 4. get OWM data from DB by using geocode
                function(callback){
                    self.getDataFromOWM(req, function(err){
                        log.info('WW> get OWM data');

                        // goto next step
                        callback(null);
                    });
                },
                // 4. get WU data from DB by using geocode
                function(callback){
                    self.getDataFromWU(req, function(err){
                        log.info('WW> get WU data');

                        // goto next step
                        callback(null);
                    });
                },
                // 5. merge weather data
                function(callback){
                    self.makeDefault(req);
                    self.mergeWeather(req);
                    callback(null);
                }
        ],
        function(err, result){
            log.info('WW> Finish to make weather data');
            next();
        });
    };

    self.checkCommand = function(req, res, next){
        if(req.query.command === undefined){
            next();
            return;
        }

        switch(req.query.command){
            case 'restart':
                next();
                break;
            case 'renew_geocode_list':
                self.loadGeocodeList(req, function(err){
                    if(err){
                        req.error = err;
                    }
                    next();
                });
                break;
            default:
                log.error('WW> unknown command :' + req.query.command);
                next();
                break;
        }
    };

    self.isValidCategory = function(req){
        if(req.params.category === undefined){
            log.error('there is no category');
            return false;
        }

        for(var i in weatherCategory){
            if(weatherCategory[i] === req.params.category){
                return true;
            }
        }

        return false;
    };

    self.getCode = function(req){
        if(req.query.gcode === undefined){
            log.error('WW> can not find geocode from qurey');
            req.error = 'WW> Can not find geocode from query';
            return false;
        }

        var geocode = req.query.gcode.split(',');
        if(geocode.length !== 2){
            log.error('WW> wrong goecode : ', geocode);
            req.error = 'WW> wrong geocode : ' + geocode;
            return false;
        }

        req.geocode = {lat:geocode[0], lon:geocode[1]};

        return true;
    };

    self.loadGeocodeList = function(callback){
        log.silly('WW> IN loadGeocodeList');

        try{
            modelGeocode.find({}, {_id:0}).lean().exec(function (err, tList){
                if(err){
                    log.error('WW> Can not found geocode:', + err);
                    callback(new Error('WW> Can not found geocode:', + err));
                    return;
                }

                if(tList.length <= 0){
                    log.error('WW> There are no geocode in the DB');
                    callback(new Error('WW> There are no geocode in the DB'));
                    return;
                }

                self.geocodeList = tList;
                callback(0);
            });
        }
        catch(e){
            callback(new Error('WW> catch exception when loading geocode list from DB'));
        }
    };

    self.checkGeocode = function(geocode){
        for(var i = 0; i < self.geocodeList.length ; i++){
            if((self.geocodeList[i].lon === geocode.lon) && (self.geocodeList[i].lat === geocode.lat)){
                return true;
            }
        }

        return false;
    };

    self.getDataFromMET = function(req, callback){
        req.MET = {};
        callback(0, req.MET);
    };

    self.getDataFromOWM = function(req, callback){
        req.OWM = {};
        callback(0, req.OWM);
    };

    self.getDataFromWU = function(req, callback){
        req.WU = {};
        callback(0, req.WU);
    };

    self.makeDefault = function(req){
        req.weather = {};
    };

    self.mergeWeather = function(req){
        if(req.MET){
            // TODO : merge MET data
        }

        if(req.OWM){
            // TODO : merge OWM data
        }

        if(req.WU){
            // TODO : merge WU data
        }
    };

    self.requestAddingGeocode = function(req, callback){
        var base_url = config.url.requester;
        var key = 'abcdefg';

        var url = base_url + 'req/ALL/req_code?key=' + key + '&gcode=' + req.geocode.lat + ',' + req.geocode.lon;

        log.info('WW> req url : ', url);
        try{
            request.get(url, {timeout: 1000 * 1}, function(err, response, body){
                if(err){
                    log.error('WW> Fail to request adding geocode to db');
                    callback(err);
                    return;
                }

                log.info('WW> request success');
                callback(0);
            });
        }
        catch(e){
            callback(new Error('WW> something wrong!'));
        }
    };

    return self;
}

module.exports = controllerWorldWeather;