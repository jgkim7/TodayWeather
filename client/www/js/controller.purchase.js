/**
 * https://github.com/WizardFactory/TodayWeather/issues/524
 * Created by aleckim on 2016. 4. 11..
 */

angular.module('controller.purchase', [])
    .factory('Purchase', function($rootScope, $http, $q, TwAds) {
        var obj = {};
        obj.ACCOUNT_LEVEL_LOVER = 'lover';
        obj.ACCOUNT_LEVEL_PREMIUM = 'premium';
        obj.accountLevel;
        obj.productId;
        obj.expirationDate;
        obj.loaded = false;
        obj.products;

        obj.setAccountLevel = function (accountLevel) {
            if (obj.accountLevel != accountLevel) {
                console.log('set account level ='+accountLevel);
                //update accountLevel
                obj.accountLevel = accountLevel;
                if (accountLevel === obj.ACCOUNT_LEVEL_LOVER) {
                    TwAds.setEnableAds(true);
                }
                else if (accountLevel === obj.ACCOUNT_LEVEL_PREMIUM) {
                    TwAds.setEnableAds(false);
                }
            }
            else {
                console.log('account level is already set level='+accountLevel);
            }
        };

        obj.checkReceiptValidation = function(storeReceipt, callback) {
            $http({
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                url: "http://192.168.0.5:3000/v000705/check-purchase",
                data: storeReceipt,
                timeout: 10*1000
            })
                .then(function (result) {
                    callback(undefined, result.data);
                },
                function (err) {
                    callback(err);
                });
        };

        obj.saveStoreReceipt = function (storeReceipt) {
            localStorage.setItem("storeReceipt", JSON.stringify(storeReceipt));
        };

        obj.loadStoreReceipt = function () {
            return JSON.parse(localStorage.getItem("storeReceipt"));
        };

        obj.loadPurchaseInfo = function () {
            console.log('load purchase info');
            var purchaseInfo = JSON.parse(localStorage.getItem("purchaseInfo"));

            if (purchaseInfo != undefined) {
                console.log('load purchaseInfo='+JSON.stringify(purchaseInfo));
                obj.expirationDate = purchaseInfo.expirationDate;
                //check account date
                if ((new Date(purchaseInfo.expirationDate)).getTime() < Date.now()) {
                    console.log('account expired, please renewal or restore');
                    purchaseInfo.accountLevel = obj.ACCOUNT_LEVEL_LOVER;
                }
                obj.setAccountLevel(purchaseInfo.accountLevel);
            }
            else {
                obj.accountLevel = obj.ACCOUNT_LEVEL_LOVER;
            }
        };

        obj.savePurchaseInfo = function (accountLevel, expirationDate) {
            var purchaseInfo = {accountLevel: accountLevel, expirationDate: expirationDate};
            localStorage.setItem("purchaseInfo", JSON.stringify(purchaseInfo));

            if (purchaseInfo.accountLevel === obj.ACCOUNT_LEVEL_PREMIUM) {
                TwAds.saveTwAdsInfo(false);
            }
            else {
                TwAds.saveTwAdsInfo(true);
            }
        };

        obj.updatePurchaseInfo = function () {
            var restoreFunc = function () {
                if (ionic.Platform.isIOS()) {
                    return inAppPurchase.getReceipt().then(function (receipt) {
                        if (receipt == undefined) {
                            return undefined;
                        }
                        return  {type: 'ios', id: obj.productId, receipt: receipt};
                    });
                }
                else if (ionic.Platform.isAndroid()) {
                    return inAppPurchase.restorePurchases().then(function(data) {
                        console.log('Purchases INFO!!!');
                        console.log(JSON.stringify(data));
                        console.log('receipt count='+data.length);
                        data.forEach(function (purchase) {
                           var inReceipt = JSON.parse(purchase.receipt);
                            console.log('receipt: '+JSON.stringify(inReceipt));
                            console.log('purchaseTime='+new Date(inReceipt.purchaseTime));
                        });
                        if (data.length == 0) {
                            return undefined;
                        }
                        //if you have many product find by product id
                        return {type: 'android', id: obj.productId, receipt: data};
                    });
                }
                else {
                    throw new Error("Unknown platform");
                }
            };

            return restoreFunc()
                .then(function (storeReceipt) {
                    if (storeReceipt == undefined)  {
                        throw new Error("Can not find any purchase");
                    }
                    obj.saveStoreReceipt(storeReceipt);
                    var deferred = $q.defer();
                    obj.checkReceiptValidation(storeReceipt, function (err, receiptInfo) {
                        if (err) {
                            deferred.reject(new Error("Fail to connect validation server. Please restore after 1~2 minutes"));
                            return;
                        }

                        deferred.resolve(receiptInfo);
                    });
                    return deferred.promise;
                })
        };

        return obj;
    })
    .run(function($ionicPlatform, $ionicPopup, $q, Purchase) {

        Purchase.loadPurchaseInfo();

        function checkPurchase() {
            var storeReceipt;
            var updatePurchaseInfo;

            storeReceipt = Purchase.loadStoreReceipt();
            if (storeReceipt) {

                console.log('Purchases INFO!!!');
                console.log(JSON.stringify(storeReceipt));
                console.log('receipt count='+storeReceipt.length);
                storeReceipt.forEach(function (purchase) {
                    var inReceipt = JSON.parse(purchase.receipt);
                    console.log('receipt: '+JSON.stringify(inReceipt));
                    console.log('purchaseTime='+new Date(inReceipt.purchaseTime));
                });

                updatePurchaseInfo = function () {
                    var deferred = $q.defer();
                    Purchase.checkReceiptValidation(storeReceipt, function (err, receiptInfo) {
                        if (err) {
                            deferred.reject(new Error("Fail to connect validation server. Please restore after 1~2 minutes"));
                            return;
                        }

                        deferred.resolve(receiptInfo);
                    });
                    return deferred.promise;
                };
            }
            else {
               updatePurchaseInfo = Purchase.updatePurchaseInfo;
            }

            updatePurchaseInfo()
                .then(function (receiptInfo) {
                    Purchase.loaded = true;
                    if (!receiptInfo.ok) {
                        //downgrade by canceled, refund ..
                        console.log(JSON.stringify(receiptInfo.data));
                        Purchase.setAccountLevel(Purchase.ACCOUNT_LEVEL_LOVER);
                        Purchase.savePurchaseInfo(Purchase.accountLevel, Purchase.expirationDate);

                        $ionicPopup.alert({
                            title: 'check purchase',
                            template: receiptInfo.data.message
                        });
                    }
                    else {
                        console.log('welcome premium user');
                    }
                })
                .catch(function (err) {
                    //again to check purchase info
                    console.log('fail to check purchase info err='+err.message);
                });
        }

        $ionicPlatform.ready(function() {

            //check purchase state is canceled or refund
            if (Purchase.loaded) {
                console.log('already check purchase info');
                return;
            }

            if (!inAppPurchase) {
                console.log('in app purchase is not ready');
                return;
            }

            Purchase.productId = 'non1year';
            console.log('productId='+Purchase.productId);

            inAppPurchase
                .getProducts([Purchase.productId])
                .then(function (products) {
                    console.log(JSON.stringify(products));
                    Purchase.products =  products;
                    if (storeReceipt == undefined && Purchase.loaded === false) {
                        //It seems fail to check purchase info
                        //retry check purchase info
                        checkPurchase();
                    }
                })
                .catch(function (err) {
                    console.log('Fail to get products of id='+Purchase.productId);
                    console.log(err);
                });

            if (Purchase.accountLevel === Purchase.ACCOUNT_LEVEL_LOVER) {
                console.log('account Level is '+Purchase.accountLevel);
                Purchase.loaded = true;
                return;
            }

            //some times fail to get restorePurchases because inAppPurchase is not ready
            checkPurchase();
        });
    })
    .controller('PurchaseCtrl', function($scope, $ionicPlatform, $ionicLoading, $http, $ionicHistory, $ionicPopup, Purchase, TwAds) {

        var spinner = '<ion-spinner icon="dots" class="spinner-stable"></ion-spinner><br/>';

        $scope.order = function () {
            $ionicLoading.show({ template: spinner + 'Purchasing...' });
            console.log('subscribe product='+Purchase.productId);
            inAppPurchase
                .subscribe(Purchase.productId)
                .then(function (data) {
                    console.log('subscribe ok!');
                    console.log(JSON.stringify(data));
                    $ionicPopup.alert({
                        title: 'subscribe',
                        template: JSON.stringify(data)
                    });
                    if (ionic.Platform.isIOS()) {
                       return {type: 'ios', id: Purchase.productId, receipt: data.receipt};
                    }
                    else if (ionic.Platform.isAndroid()) {
                       return {type: 'android', id: Purchase.productId, receipt: [data]}
                    }
                })
                .then(function (storeReceipt) {
                    //$ionicLoading.hide();
                    console.log(storeReceipt);
                    Purchase.saveStoreReceipt(storeReceipt);
                    Purchase.checkReceiptValidation(storeReceipt, function (err, receiptInfo) {
                        $ionicLoading.hide();
                        if (err) {
                            console.log(err);
                            throw new Error('Fail to connect validation server. Please restore after 1~2 minutes');
                        }
                        console.log(JSON.stringify(receiptInfo));
                        if (!receiptInfo.ok) {
                            console.log(JSON.stringify(receiptInfo.data));
                            throw new Error(receiptInfo.data.message);
                        }

                        Purchase.setAccountLevel(Purchase.ACCOUNT_LEVEL_PREMIUM);
                        Purchase.expirationDate = receiptInfo.data.expires_date;
                        $scope.accountLevel = Purchase.ACCOUNT_LEVEL_PREMIUM;
                        $scope.expirationDate = (new Date(Purchase.expirationDate)).toLocaleDateString();
                        console.log('set accountLevel='+$scope.accountLevel);
                        Purchase.savePurchaseInfo(Purchase.accountLevel, Purchase.expirationDate);
                    });
                })
                .catch(function (err) {
                    $ionicLoading.hide();
                    console.log('subscribe error');
                    console.log(err);
                    $ionicPopup.alert({
                        title: 'subscribe error',
                        template: err.message
                    });
                });
        };

        $scope.restore = function () {
            $ionicLoading.show({ template: spinner + 'Restoring Purchases...' });

            Purchase.updatePurchaseInfo()
                .then(function (receiptInfo) {
                    $ionicLoading.hide();

                    if (!receiptInfo.ok) {
                        console.log(JSON.stringify(receiptInfo.data));
                        throw new Error(receiptInfo.data.message);
                        return;
                    }
                    else {
                        Purchase.setAccountLevel(Purchase.ACCOUNT_LEVEL_PREMIUM);
                        Purchase.expirationDate = receiptInfo.data.expires_date;
                        $scope.accountLevel = Purchase.ACCOUNT_LEVEL_PREMIUM;
                        $scope.expirationDate = (new Date(Purchase.expirationDate)).toLocaleDateString();
                        console.log('set accountLevel=' + $scope.accountLevel);
                        Purchase.savePurchaseInfo(Purchase.accountLevel, Purchase.expirationDate);
                    }
                })
                .catch(function (err) {
                    $ionicLoading.hide();
                    console.log(err);
                    $ionicPopup.alert({
                        title: 'restore error',
                        template: err.message
                    });
                });
        };

        $scope.goBack = function() {
            $ionicHistory.goBack();
        };

        $scope.$on('$ionicView.leave', function() {
            TwAds.setShowAds(true);
        });

        $scope.$on('$ionicView.enter', function() {
            TwAds.setShowAds(false);
            if (window.StatusBar) {
                StatusBar.backgroundColorByHexString('#0288D1');
            }
        });

        $ionicPlatform.ready(function() {
            //for fast close ads when first loading
            TwAds.setShowAds(false);
            $scope.accountLevel = Purchase.accountLevel;
            $scope.expirationDate = (new Date(Purchase.expirationDate)).toLocaleDateString();

            $scope.product = Purchase.products[0];
        });
    });