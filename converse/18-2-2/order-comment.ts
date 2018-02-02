/**
 * 工单留言列表
 */
import { Component, Input, EventEmitter, ElementRef, ViewChild, Renderer } from '@angular/core';

import { NavParams, NavController, Events, AlertController,ModalController } from 'ionic-angular';

import { ServiceOrderData } from "../../../providers/serviceorder-data";
import { AppGlobal } from "../../../app/app.global";
import { File } from '@ionic-native/file';
import { Transfer } from '@ionic-native/transfer';
import { FileOpener } from '@ionic-native/file-opener';
import { ImageSlidesPage } from "../moment/image-slides";

import { ShowImgPage } from "../../show-img/show-img";

declare var cordova: any;
@Component({
    selector: 'page-order-comment',
    templateUrl: 'order-comment.html'
})
export class ServiceOrderCommentPage {

    order: any;
    orderInstance: any;
    webUser: any;
    comments: any;
    commentSourceEnum = {"1":"PC","2":"iPhone","3":"Android","4":"IM"};//以后从数据库中拿
    pageIndex: number = 0;
    isRefresh: boolean = true;
    tenant: any;

    isWeb: boolean = false;

    constructor(public navParams: NavParams,
        public navCtrl: NavController,
        public serviceOrderData: ServiceOrderData,
        private file: File,
        private transfer: Transfer,
        private modalCtrl: ModalController,
        private fileOpener: FileOpener,
        public alertCtrl: AlertController) {
        this.order = navParams.get('order');
        this.orderInstance = navParams.get('orderInstance');
        if (AppGlobal.getInstance().itsnowUser) {

            this.webUser = AppGlobal.getInstance().itsnowUser.userObj;

            this.tenant = AppGlobal.getInstance().itsnowUser.tenant;

        }
        console.log('web user:', this.webUser);

        if (!File['installed']()) {
            this.isWeb = true;
        }

        this.serviceOrderData.getServiceOrderCommentList(this.tenant, this.orderInstance.workFlowProcessId, 0, 10).then(data => {
            if (data) {
                console.log("commentListData:", data);
                this.comments = [];
                data.body.reverse();
                let arry: any = [];

                data.body.forEach(comment => {

                    try {
                        if (comment.attachment) {
                            comment.files = [];
                                let imageIndex = 0;
                                comment.attachment.forEach(attachmentData => {
                                    let sourceData = AppGlobal.getInstance().OPERATION_URL + '/operation/';
                                    sourceData = sourceData + attachmentData.dir + '/' + attachmentData.name;
                                    //attachmentFileName = attachmentData.dir + attachmentData.name;
                                    let attachmentFileName = attachmentData.dir + attachmentData.name.substring(attachmentData.name.lastIndexOf('.'), attachmentData.name.length);
                                    console.log('attachmentFileName:'+attachmentFileName)
                                    let location: any = new String(attachmentData.name);
                                    let point = location.lastIndexOf(".") + 1;
                                    
                                    let contentType = location.substring(point).toLocaleLowerCase();
                                    
                                    attachmentData.contentType = contentType;
                                    let fileData: any = { name: attachmentData.name, contentType: attachmentData.contentType, data: attachmentData };
                                    attachmentData.attachmentFileName = attachmentFileName;
                                    attachmentData.sourceData = sourceData;
                                    if (contentType === 'jpg' || contentType === 'jpeg' || contentType === 'gif' || contentType === 'png' || contentType === 'bmp') {
                                        fileData.type = 'image';
                                        attachmentData.type = 'image'
                                        attachmentData.imageIndex = imageIndex;
                                        fileData.imageIndex = imageIndex;
                                        imageIndex ++;
                                    } else {
                                        fileData.type = 'file';
                                        attachmentData.type = 'file'
                                    }

                                    if (this.isWeb) {
                                        fileData.name = attachmentData.name;
                                        console.log(fileData.name)
                                        fileData.path = sourceData;
                                        fileData.ios = AppGlobal.getInstance().isIos;
                                        fileData.isWeb = this.isWeb;
        
                                        comment.files.push(fileData);
                                    } else {

                                        let attachmentFilePath;

                                        if (AppGlobal.getInstance().isIos) {
                                            attachmentFilePath = cordova.file.documentsDirectory + AppGlobal.getInstance().LOCAL_FILE_NAME + "/";
                                        } else {
                                            attachmentFilePath = cordova.file.externalApplicationStorageDirectory + AppGlobal.getInstance().LOCAL_FILE_NAME + "/";
                                        }

                                        if(fileData.type === 'image'){
                                            this.getImagePath(sourceData, attachmentFilePath, attachmentFileName).then(
                                                (sizerFilePath: string) => {
                                                    fileData.path = attachmentFilePath + attachmentFileName;
                                                    fileData.ios = AppGlobal.getInstance().isIos;
                                                    fileData.isShow = true;
                                                    console.log("fileImgUrl:" + fileData.path);
                                                }, () => { console.log('Error occured'); }
                                            );
        
                                        } else {
        
                                            this.file.checkFile(attachmentFilePath, attachmentFileName).then(isExist => {
                                                fileData.path = attachmentFilePath + attachmentFileName;
                                                fileData.ios = AppGlobal.getInstance().isIos;
        
                                            }).catch(err => {
        
                                                const fileTransfer = this.transfer.create();
        
                                                fileTransfer.download(encodeURI(sourceData), attachmentFilePath + attachmentFileName).then((entry) => {
                                                    fileData.path = attachmentFilePath + attachmentFileName;
                                                    fileData.ios = AppGlobal.getInstance().isIos;
                                                }, (error) => {
                                                    //handle error
                                                    console.log("fileDownloadErr:" + error);
                                                });
                                            });
                                        }
        
                                        comment.files.push(fileData);
                                    }
                                    /*
                                    this.getImagePath(sourceData, attachmentFilePath, attachmentFileName).then(
                                        (sizerFilePath: string) => {
                                            if(AppGlobal.getInstance().isIos){
                                                comment.files.push({url:attachmentFilePath + attachmentFileName});
                                            } else {
                                                comment.files.push({url:sizerFilePath});
                                            }
                                            console.log('comments files:'+JSON.stringify(comment.files));
                                        },() => { console.log('Error occured'); }
                                    );
                                    */
                                });
                            }
                        
                    } catch (error) {

                    }

                    //设备
                    if (AppGlobal.getInstance().isIos) {
                        comment.ios = true;
                    }
                    if(comment.commentSource){
                        comment.commentSourcLabel = this.commentSourceEnum[comment.commentSource];
                    }
                    
                    let time = new Date(comment.createTime);
                    let year = time.getFullYear();
                    let month = time.getMonth() + 1;
                    let day = time.getDate();
                    let date = year + '-' + month + '-' + day;
                    arry[arry.length] = { date: date, list: [comment] };

                });

                let hash = {};
                let index = -1;

                for (let i = 0; i < arry.length; i++) {
                    if (!hash[arry[i].date]) {
                        index++;
                        hash[arry[i].date] = true;
                        this.comments[index] = arry[i];
                    } else {
                        this.comments[index].list.push(arry[i].list[0]);
                    }
                }
                if (data && data.totalSize === arry.length) {
                    this.isRefresh = false;
                }

                console.log("comments:",this.comments);
            }
        })
            .catch(error => {
                console.error(error);
            });
    }

    /**
     * 返回指定文件夹中图片地址，如果图片不存在则进行下载，存在则进行压缩
     * @sourceData 下载文件地址
     * @filePath 文件所在文件夹地址
     * @fileName 文件名称，带后缀
     */
    getImagePath(sourceData, filePath, fileName): Promise<any> {
        //查看文件夹否存在，存在则进行压缩，不存在进行下载
        return this.file.checkFile(filePath, fileName).then(isExist => {
            
        }).catch(err => {

            const fileTransfer = this.transfer.create();

            return fileTransfer.download(encodeURI(sourceData), filePath + fileName).then((entry) => {
            }, (error) => {
                //handle error
                console.log("fileDownloadErr:" + error);
            });
        });
    }

    showImg(event, file,selectFile) {
        console.log(file);
        console.log(selectFile);
        let commentPics = [];
        file.forEach(element => {
            if(element.type === 'image'){
                commentPics.push(element);
            }
        });
        this.modalCtrl.create(ShowImgPage, {
            originImgList:commentPics,
            imgIndex:selectFile.imageIndex,
            type:"operate"
        }, {
            enterAnimation: 'modal-scale-enter',
            leaveAnimation: 'modal-scale-leave'
        }).present();
    }

    doRefresh(refresher) {
        this.pageIndex = this.pageIndex + 1;
        this.serviceOrderData.getServiceOrderCommentList(this.tenant, this.orderInstance.workFlowProcessId, this.pageIndex, 10).then(data => {
            if (data) {
                let arry = [];

                data.body.forEach(comment => {
                    try {
                        if (comment.attachment) {
                            comment.files = [];

                            let attachmentFilePath;

                            if (AppGlobal.getInstance().isIos) {
                                attachmentFilePath = cordova.file.documentsDirectory + "images/";
                            } else {
                                attachmentFilePath = cordova.file.externalApplicationStorageDirectory + "images/";
                            }
                            let imageIndex = 0;
                            comment.attachment.forEach(attachmentData => {
                                let sourceData = AppGlobal.getInstance().OPERATION_URL + '/operation/';
                                sourceData = sourceData + attachmentData.dir + '/' + attachmentData.name;
                                //attachmentFileName = attachmentData.dir + attachmentData.name;
                                let attachmentFileName = attachmentData.dir + attachmentData.name.substring(attachmentData.name.lastIndexOf('.'), attachmentData.name.length);

                                let fileData: any = { name: data.name, contentType: data.contentType, data: data };
                                let location: any = new String(attachmentData.name);
                                let point = location.lastIndexOf(".") + 1;

                                let contentType = location.substring(point).toLocaleLowerCase();
                                
                                attachmentData.contentType = contentType;



                                attachmentData.attachmentFileName = attachmentFileName;
                                attachmentData.sourceData = sourceData;
                                if (contentType === 'jpg' || contentType === 'jpeg' || contentType === 'gif' || contentType === 'png' || contentType === 'bmp') {
                                    fileData.type = 'image';
                                    attachmentData.type = 'image'
                                    attachmentData.imageIndex = imageIndex;
                                    fileData.imageIndex = imageIndex;
                                    imageIndex ++;
                                    this.getImagePath(sourceData, attachmentFilePath, attachmentFileName).then(
                                        (sizerFilePath: string) => {
                                            fileData.path = attachmentFilePath + attachmentFileName;
                                            if (AppGlobal.getInstance().isIos) {
                                                fileData.ios = true;
                                            }
                                            console.log("fileImgUrl:" + fileData.path);
                                        }, () => { console.log('Error occured'); }
                                    );

                                } else {
                                    fileData.type = 'file';
                                    attachmentData.type = 'file'
                                    this.file.checkFile(attachmentFilePath, attachmentFileName).then(isExist => {
                                        fileData.path = attachmentFilePath + attachmentFileName;
                                        fileData.ios = AppGlobal.getInstance().isIos;

                                    }).catch(err => {

                                        const fileTransfer = this.transfer.create();

                                        fileTransfer.download(encodeURI(sourceData), attachmentFilePath + attachmentFileName).then((entry) => {
                                            fileData.path = attachmentFilePath + attachmentFileName;
                                            fileData.ios = AppGlobal.getInstance().isIos;
                                        }, (error) => {
                                            //handle error
                                            console.log("fileDownloadErr:" + error);
                                        });
                                    });
                                }

                                comment.files.push(fileData);

                            });
                        }
                    } catch (error) {

                    }

                    //设备
                    if (AppGlobal.getInstance().isIos) {
                        comment.ios = true;
                    }

                    if(comment.commentSource){
                        comment.commentSourcLabel = this.commentSourceEnum[comment.commentSource];
                    }
                    //this.comments.unshift(comment);

                    let time = new Date(comment.createTime);
                    let year = time.getFullYear();
                    let month = time.getMonth() + 1;
                    let day = time.getDate();
                    let date = year + '-' + month + '-' + day;
                    arry[arry.length] = { date: date, list: [comment] };
                });

                let hash = {};
                let index = this.comments.length - 1;
                let num: number = arry.length;
                this.comments.forEach(c => {
                    hash[c.date] = true;
                    num += c.list.length;
                });

                for (let i = 0; i < arry.length; i++) {
                    if (!hash[arry[i].date]) {
                        index++;
                        hash[arry[i].date] = true;
                        this.comments[index] = arry[i];
                    } else {
                        this.comments[index].list.unshift(arry[i].list[0]);
                    }
                }

                this.comments.sort(function (a, b) {
                    var a_tiem = new Date(a.date).getTime();
                    var b_time = new Date(b.date).getTime();
                    return a_tiem - b_time;
                });


                console.log(this.comments);

                if (data && data.totalSize === num) {
                    this.isRefresh = false;
                }

                refresher.complete();
            }
        })
        .catch(error => {
            console.error(error);
        });

    }

    showFile(fileInfo) {
        AppGlobal.getInstance().flag = "showFile";
        console.log('showFile:' + fileInfo.path);
        let path = fileInfo.path;
        let fileType = fileInfo.contentType;
        this.fileOpener.open(path, AppGlobal.getInstance().fileIMMEType[fileType])
            .then(() => {AppGlobal.getInstance().flag = '';console.log('File is opened')})
            .catch(e => {
                AppGlobal.getInstance().flag = '';
                // let alert = this.alertCtrl.create({
                //     title: JSON.stringify(e),
                //     buttons: ['确认']
                // });
                // alert.present();
            });
    }

    getFileName(file){
        file = file||"";
        let s:String = new String(file);
        let type = "inf";
        if(s.lastIndexOf("\.")+1<s.length){
            type = s.substring(s.lastIndexOf("\.")+1).toLocaleLowerCase();
        }
        return  `assets/fileIcon/${type}.png`
    }
}
