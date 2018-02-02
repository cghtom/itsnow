/**
 * 工单添加留言
 */
import { Component,ViewChild,ElementRef,Renderer, EventEmitter,Input} from '@angular/core';
import { NavParams,DateTime, Content,Navbar,NavController,
    Platform,ToastController,ViewController,normalizeURL,AlertController, 
    PopoverController,Events, ModalController,ActionSheetController, 
    LoadingController } from 'ionic-angular';
import {AppGlobal} from "../../../app/app.global";

import {ServiceOrderCommentPage} from "./order-comment";
import {ServiceOrderData} from "../../../providers/serviceorder-data";
import {UploadImg} from "../../../providers/upload-img";

import { FileOpener } from '@ionic-native/file-opener';
import { File} from '@ionic-native/file';
import { PhotoViewer } from '@ionic-native/photo-viewer';
import { FileChooser } from '@ionic-native/file-chooser';
import { FilePath } from '@ionic-native/file-path';
import { FormBuilder, Validators, FormGroup, FormControl} from '@angular/forms';
import { Camera } from '@ionic-native/camera';
import { NativeService } from "../../../providers/native-service";
import { UserData} from "../../../providers/user-data";
@Component({
    selector: 'page-order-addcomment',
  template: `
    <ion-header>
      <ion-navbar>
          <ion-title>留言</ion-title>
      </ion-navbar>
  </ion-header>
  
  <ion-content >

    <form [formGroup]="form" (ngSubmit)="addComment()">
      <div *ngFor="let field of commentForm.fields2">
          <div *ngFor="let child of field.childs">
              <div [ngSwitch]="child.control">
                  <ion-item *ngSwitchCase= "'textarea'">
                      <ion-label color="primary"><span color="danger" *ngIf="child.required && !child.readonly">*</span>{{child.label}}</ion-label>
                      <ion-textarea #inputText  (ionChange)="changeTextHeight()" [formControlName]="child.name" [disabled]="child.readonly!=null?child.readonly:readonly" ></ion-textarea>
                  </ion-item>
                  <ion-item *ngSwitchCase= "'attachment2'" style="border-bottom: 1px #ddd solid">
                      <ion-label color="primary">{{child.label}}</ion-label>
                      <div item-content>

                            <ion-icon class="add-folder" *ngIf="isIos && child.controlSetting.imageType && uploadShow && !isWeb" ion-button type="button" (click)="choosePhoto($event, child)" ios="ios-images" md="md-images"></ion-icon>

                            <ion-icon class="add-folder" ios="ios-folder-open" md="md-folder-open" *ngIf="!isIos && uploadShow && !isWeb" ion-button type="button" (click)="chooseFile($event, child)" ></ion-icon>

                            <ion-icon class="add-camera"  *ngIf="child.controlSetting.imageType && uploadShow && !isWeb" ion-button type="button" (click)="takePhoto($event, child)"  ios="ios-camera" md="md-camera"></ion-icon>

                            <ion-icon class="add-folder" ios="ios-folder-open" md="md-folder-open" *ngIf="isWeb && uploadShow" ion-button type="button" (click)="webChooseFile($event, child)" ></ion-icon>

                              <ion-thumbnail item-right *ngIf="profileFile">
                                  <div class="file-tool2">
                                      <div *ngFor="let selectFile of profileFile" >
                                          <div class="detail-file-up2" *ngIf="selectFile.type && selectFile.type === 'image'">
                                              <img src="" [avatarImg]="selectFile.path" />
                                              <ion-icon class="delete-img2" ion-button type="button" (click)="delFile(selectFile, child)" ios="ios-close-circle"
                                              md="md-close-circle"></ion-icon> 
                                          </div>
                                      </div>
                                  </div>
                                  <div *ngFor="let selectFile of profileFile" >
                                        <ion-item *ngIf="selectFile.type && selectFile.type === 'file'">
                                            <ion-thumbnail item-start>
                                                <img src='{{getFileName(selectFile.name)}}' onerror="this.src = 'assets/fileIcon/inf.png'" (tap)="showImg( selectFile)" />
                                            </ion-thumbnail>
                                            <p style="width: 90%;">{{selectFile.name}}</p>                                       
                                            <ion-icon class="delete-cut" ion-button type="button" (click)="delFile(selectFile, child)" ios="ios-close-circle-outline"
                                            md="md-close-circle"></ion-icon>
                                        </ion-item>
                                  </div>
                              </ion-thumbnail>
                          
                          
                      </div>
                  </ion-item>
                  </div>
          </div>
      </div>

      <button ion-button [disabled]="hideSubmit||!form.valid" type="submit" block>确定</button>
      
    </form>
    <button ion-button (click)="close()" block>取消</button>
    </ion-content >

    <input type="file" #addCommentFileInput style="visibility:hidden; height: 0px;width:0;" name="files[]"
       (change)="processWebImage($event)"/>
  `
})
export class AddCommentPage {

    order: any;
    orderInstance: any;
    form:any = {};
    webUser: any;
    tenant: any;
    public base64Image: string;
    profilePicture: any;
    files:any = [];
    commentForm:any;
    isIos:boolean = false;
    uploadShow:boolean = true;
    uploadClickCount:any = 0;
    profileFile:any = [];
    isWeb: boolean = false;
    @ViewChild('inputText') inputText : ElementRef;
    @ViewChild('addCommentFileInput') addCommentFileInput;
    initBottomHeight:number = 34; //底部框最小高度;
    lastBottomScrollHeight:number = 0; //上一次滚动height
    chatRoomMargin :number = 0;//chatroom页面的弹起高度
    keyboardHeight:number = 0; //键盘高度
    hideSubmit:boolean = false;

    constructor(public viewCtrl: ViewController,
                public navParams: NavParams,
                public navCtrl: NavController,
                public serviceOrderData: ServiceOrderData,
                public uploadImg: UploadImg,
                public alertCtrl: AlertController,
                private fileOpener: FileOpener,
                private photoViewer:PhotoViewer,
                private fileChooser:FileChooser,
                private filePath:FilePath,
                private file:File,
                private renderer: Renderer,
                private events: Events,
                public fb: FormBuilder,
                public nativeService: NativeService,
                public actionSheetCtrl: ActionSheetController,
                public userService: UserData,
                public camera: Camera) {
        this.order = navParams.data.order;
        this.orderInstance = navParams.data.orderInstance;
        if(AppGlobal.getInstance().itsnowUser) {
            this.webUser = AppGlobal.getInstance().itsnowUser.userObj;
            this.tenant = AppGlobal.getInstance().itsnowUser.tenant;
         }
         this.commentForm = navParams.data.commentForm;
         this.isIos = AppGlobal.getInstance().isIos;

         this.buildForm();

        if (!(Camera['installed']() && File['installed']())) {
            this.isWeb = true;
        }
    }

    buildForm(){
      let item:any = {};
        for(let i = 0; i< this.commentForm.fields2.length; i++){
            let file = this.commentForm.fields2[i];
            if(file.control === 'layout' && file.childs && file.childs.length > 0 ){
                for(let j = 0; j < file.childs.length; j++){
                    if(file.childs[j].control != 'layout' ){
                        let validate:any = this.buildFormItem(file.childs[j]);
                        
                        if(validate.length > 0){
                            item[file.childs[j].name] = ["", Validators.compose(validate)];
                        } else {
                            item[file.childs[j].name] = [""];
                        }  
                    }

                    if(file.childs[j].childs && file.childs[j].childs.length > 0){
                        file.childs[j].childs.forEach(child => {
                            if(child.name && child.control != 'layout' && child.control != 'comment-area'){
                                let validate:any = this.buildFormItem(child);
                                
                                if(validate.length > 0){
                                    item[child.name] = ["", Validators.compose(validate)];
                                } else {
                                    item[child.name] = [""];
                                }
                                console.log('-------file:'+child.name);
                            }

                        });
                    }
                }
            } 
        }
        
        this.form = this.fb.group(item);
    }

    buildFormItem(file) {
        let validate:any = [];
        if(file.controlSetting.inputReg){
            validate[validate.length] = Validators.pattern(file.controlSetting.inputReg);
        }
        if(file.controlSetting.maxLength){
            validate[validate.length] = Validators.maxLength(Number(file.controlSetting.maxLength));
        }
        if(file.controlSetting.minLength){
            validate[validate.length] = Validators.minLength(Number(file.controlSetting.minLength));
        }
        if(file.required){
            console.log('file_required-------------------:'+file.name + ', value:'+this.orderInstance[file.name]);
            validate[validate.length] = Validators.required;
            if (file.control == 'text' || file.control == 'textarea'){
                // validate[validate.length] = Validators.pattern(".*[^ ].*");
            }
        }
        if(file.control === 'phone' && (!file.controlSetting.inputReg)){
            validate[validate.length] = Validators.pattern("1(3[0-9]|4[57]|5[0-35-9]|8[0-9]|7[0-9])\\d{8}");
        }

        if(file.control === 'email' && (!file.controlSetting.inputReg)){
            validate[validate.length] = Validators.pattern("[A-Za-z\\d]+([\-_\.][A-Za-z\\d]+)*@([A-Za-z\\d]+[\-\.])+[A-Za-z\\d]{2,5}");
        }
        return validate;
    }
    
    close() {
        this.viewCtrl.dismiss();
    }
    //删除和选择文件上传时判断是否隐藏上传按钮
    isHideUploadButton(field){
        if(!field.controlSetting.fileNumber){
            if(Number(field.controlSetting.fileNumber) <= 0){//0 上传文件不加限制 
                this.uploadShow = true; 
            }else{
                //undefined 默认为5
                if (this.uploadClickCount >= 5) {
                    this.uploadShow = false;
                }else{
                    this.uploadShow = true;  
                }
            }
            
        }else if(Number(field.controlSetting.fileNumber) > 0) {//上传文件个数为：field.controlSetting.fileNumber
            if (this.uploadClickCount >= Number(field.controlSetting.fileNumber)) {
                console.log("隐藏附件");
                this.uploadShow = false;
            }else{
                console.log("显示附件");
                this.uploadShow = true; 
            }
        }else{
            //配置错误 默认为5
            if (this.uploadClickCount >= 5) {
                this.uploadShow = false;
            }else{
                this.uploadShow = true;  
            }
        }
    }
    //获取本地文件的地址
    getTempFilePath(file): any {
    
        if (!!file && AppGlobal.getInstance().isCordova) {
            let filePathUrlArr = file.split('/'), pathArrLength = filePathUrlArr.length;
            let fileName = filePathUrlArr[pathArrLength - 1];
            filePathUrlArr.splice(pathArrLength - 1, 1);
            let newPathArr = 'file://' + filePathUrlArr.join('/') + '/';
            if (file.match(/^file/)) {
            newPathArr = filePathUrlArr.join('/') + '/';
            }
            return { newPathArr: newPathArr, fileName: fileName };
        } else {
            return "";
    }
    
    }
    //上传附件
    uploadService(field: any, filePath: any, judge?) {
        console.log("uploadService-filePath:"+filePath);
        let fileName,fileType;
        try{
            let path: any = new String(filePath);
            fileName = path.substring(path.lastIndexOf('/') + 1, path.length);
            fileName = decodeURIComponent(fileName);
            let fileName2: any = new String(fileName);
            fileType = fileName2.substring(fileName2.lastIndexOf('.') + 1, fileName2.length);
            fileType = AppGlobal.getInstance().fileIMMEType[fileType];
        }catch(e){
            console.log("uploadService fileName fileType undefined call upload img",e);
            fileName = undefined;
            fileType = undefined;
        }
        console.log("uploadService filePath:"+filePath+",fileName:"+fileName+",fileType:"+fileType);
        this.uploadImg.uploadImage(filePath,fileName,fileType).then((data) => {
            let file_model = JSON.parse(data.response);
            console.log('uploadResp:'+JSON.stringify(data));
            let addFile: any = { path: filePath, data: file_model, name: file_model.name,isMy: true };
            console.log('uploadFileshow:',addFile);
            let location: any = new String(file_model.name);
            let point = location.lastIndexOf("\.");
            let type = location.substring(point+1).toLocaleLowerCase();
            if(!this.filterFileType(type,judge,field)){
                this.uploadClickCount--;
                this.uploadShow = true;
                return ;
            }
            addFile.type = 'file';
            if (type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'gif' || type === 'bmp'){
                addFile.type = 'image';
            }
            this.profileFile[this.profileFile.length] = addFile;
            this.files.push(file_model);
            console.log('上传成功变量field.name = ：'+field.name);
            console.log('上传成功：'+JSON.stringify(this.files));

            let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);

            this.uploadImg.copyFile(filePath, newFileName, null, null);
        }, (err) => {
            AppGlobal.getInstance().flag = '';
            this.uploadShow = true;
            this.uploadClickCount--;
            console.log('chooseFile-error:' + err);
        });
    }
    //选择照片
    choosePhoto(event, field, judge) {
        judge = field.controlSetting.constraint;
        if (Camera['installed']()) {
            let actionSheet = this.actionSheetCtrl.create({
            title: '',
            buttons: [
                {
                text: '相册',
                handler: () => {
                    AppGlobal.getInstance().flag = "takePhoto";

                    this.uploadClickCount = this.uploadClickCount + 1;
                    this.isHideUploadButton(field);

                    actionSheet.dismiss();
                    this.nativeService.cameraOrChoosePhoto(false)
                    .then((result) => {
                        console.log('选择图片', result);
                        AppGlobal.getInstance().flag = '';
                        this.uploadService(field,result,judge);
                    })
                    .catch(err => {
                        console.log('选择图片失败', err);
                        AppGlobal.getInstance().flag = '';
                        this.uploadClickCount--;
                        this.uploadShow = true;
                    })
                    return false;
                }
                },
                {
                text: '视频',
                handler: () => {
                    console.log('选择视频 clicked');
                    AppGlobal.getInstance().flag = "takeVideo";
                    let navTransition = actionSheet.dismiss();

                    this.uploadClickCount = this.uploadClickCount + 1;
                    this.isHideUploadButton(field);

                    this.camera.getPicture({
                    quality: 50,
                    destinationType: this.camera.DestinationType.FILE_URI,
                    targetWidth: 96,
                    targetHeight: 96,
                    encodingType: this.camera.EncodingType.JPEG,
                    mediaType: this.camera.MediaType.VIDEO,
                    allowEdit: false,
                    sourceType: 0
                    }).then((data) => {
                        console.error("选择视频:", data);
                        AppGlobal.getInstance().flag = '';
                        this.uploadService(field,data,judge);
    
                    }, (err) => {
                        console.error("选择视频:", err);
                        AppGlobal.getInstance().flag = '';
                        this.uploadShow = true;
                        this.uploadClickCount--;
                    });
                    return true;
                }
                },
                {
                text: '取消',
                role: 'cancel',
                handler: () => {
                    console.log('cancel clicked');
                }
                }
            ]
            });
            actionSheet.present();
        } 
    }
    //拍照 拍摄视频
    takePhoto(event, field, judge) {
        judge = field.controlSetting.constraint;
        if (Camera['installed']()) {
            let actionSheet = this.actionSheetCtrl.create({
                title: '',
                buttons: [
                    {
                        text: '拍照',
                        handler: () => {
                            console.log('拍照 clicked');
                            AppGlobal.getInstance().flag = "takePhoto";
                            let navTransition = actionSheet.dismiss();
                
                            this.uploadClickCount  = this.uploadClickCount + 1;
                            this.isHideUploadButton(field);
                
                            this.uploadImg.cameraOrChoosePhoto(true).then((imageData) => {
                
                            console.error("takeCameras 拍照:", imageData);
                            this.uploadService(field,imageData, judge);
                
                            }, (err: any) => {
                            AppGlobal.getInstance().flag = '';
                            this.uploadShow = true;
                            this.uploadClickCount--;
                            });
                            return false;
                        }
                    },
                    {
                        text: '视频',
                        handler: () => {
                            console.log('视频 clicked');
                            AppGlobal.getInstance().flag = "takeVideo";
                            actionSheet.dismiss();
                
                            this.uploadClickCount = this.uploadClickCount + 1;
                            this.isHideUploadButton(field);
                            
                            this.nativeService.captureVideo()
                            .then(res=>{
                                console.error('拍摄视频res',res);
                                AppGlobal.getInstance().flag = "";
                                this.uploadService(field,res.fileUri,judge);
                            }, (err: any) => {
                                AppGlobal.getInstance().flag = '';
                                this.uploadClickCount--;
                                this.uploadShow = true;
                            });
                            return true;
                        }
                    },
                    {
                        text: '取消',
                        role: 'cancel',
                        handler: () => {
                            console.log('cancel clicked');
                        }
                    }
                ]
            });
            actionSheet.present();
        }
    }

    /**
     * judge :true 不做类型及数量的判断，并且field为string; false 做类型的判断及数量判断，field为object类型
     */
    takePhoto1(event, field, judge) {
        AppGlobal.getInstance().flag = "takePhoto";
        judge = field.controlSetting.constraint;
        if (judge && !field.controlSetting.imageType) {
            let alert = this.alertCtrl.create({
                title: '不能上传图片',
                buttons: ['确认']
            });
            alert.present();
            return;
        }

        this.uploadImg.cameraOrChoosePhoto(true).then((imageData) => {
            AppGlobal.getInstance().flag = '';

            console.log('takePhoto-imageData:'+imageData);
    
            this.uploadClickCount  = this.uploadClickCount + 1;
            this.isHideUploadButton(field);

            this.uploadImg.uploadImage(imageData).then((data) => {
                let file_model = JSON.parse(data.response);
                this.profileFile[ this.profileFile.length] = {path:imageData, data:file_model, type:'image'};
                this.files.push(file_model);
                console.log('上传图片成功变量：'+field.name);
                console.log('上传图片成功：'+JSON.stringify(this.files));
                let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);
                this.uploadImg.copyFile(imageData, newFileName, null, null);
            }, (err) => {
                this.uploadShow = true;
                this.uploadClickCount --;
                let alert = this.alertCtrl.create({
                    title: err,
                    buttons: ['确认']
                });
                alert.present();
            });
        }, (err) => {
            AppGlobal.getInstance().flag = '';
            console.log('takePhoto-error:' + err);
        });

    }
    
    /**
     * judge :true 不做类型及数量的判断，并且field为string; false 做类型的判断及数量判断，field为object类型
     */
    choosePhoto1(event, field, judge) {
        AppGlobal.getInstance().flag="choosePhoto";
        judge = field.controlSetting.constraint;
        if ((judge) && !field.controlSetting.imageType) {
            let alert = this.alertCtrl.create({
                title: '不能上传图片',
                buttons: ['确认']
            });
            alert.present();
            return;
        }

        console.log('choosePhoto-------------into');
        this.uploadImg.cameraOrChoosePhoto(false).then((imageData) => {
            AppGlobal.getInstance().flag = '';

            console.log('choosePhoto-imageData:'+imageData);
            this.uploadClickCount  = this.uploadClickCount + 1;
            this.isHideUploadButton(field);

            this.uploadImg.uploadImage(imageData).then((data) => {
                
                let file_model = JSON.parse(data.response);
                let location: any = new String(file_model.name);
                let point = location.lastIndexOf(".");
                let type = location.substring(point+1).toLocaleLowerCase();
                if(!this.filterFileType(type,judge,field)){
                    this.uploadClickCount--;
                    field.uploadShow = true;
                    return ;
                }
                this.profileFile[this.profileFile.length] = {path:imageData, data:file_model, type:'image'};
                
                this.files.push(file_model);
                console.log('上传图片成功变量：'+field.name);
                console.log('上传图片成功：'+JSON.stringify(this.files));
                  
                let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);
    
                this.uploadImg.copyFile(imageData, newFileName, null, null);
    
            }, (err) => {
                AppGlobal.getInstance().flag = '';
                this.uploadShow = true;
                this.uploadClickCount --;
                console.log('choosePhoto-error:' + err);
            });
        }, (err) => {
            AppGlobal.getInstance().flag = '';
            console.log('choosePhoto-error:' + err);
        });
    }

    chooseFile(event, field,judge) {
        AppGlobal.getInstance().flag = "chooseFile";
        judge = field.controlSetting.constraint;
        if (AppGlobal.getInstance().isIos) {
            return;
        }

        this.fileChooser.open()
          .then(uri => {
              AppGlobal.getInstance().flag = '';

                this.uploadClickCount  = this.uploadClickCount + 1;
                this.isHideUploadButton(field);
            
                if(uri.indexOf('content://') === 0){
                    
                    this.filePath.resolveNativePath(uri)
                        .then(filePath => {
                            console.log("uri:"+uri);
                            let fileName,fileType;
                            try{
                                let path: any = new String(filePath);
                                fileName = path.substring(path.lastIndexOf('/') + 1, path.length);
                                fileName = decodeURIComponent(fileName);
                                let fileName2: any = new String(fileName);
                                fileType = fileName2.substring(fileName2.lastIndexOf('.') + 1, fileName2.length);
                                fileType = AppGlobal.getInstance().fileIMMEType[fileType];
                            }catch(e){
                                console.log("chooseFile fileName fileType undefined call upload img",e);
                                fileName = undefined;
                                fileType = undefined;
                            }
                            console.log("chooseFile filePath:"+filePath+",fileName:"+fileName+",fileType:"+fileType);
                            this.uploadImg.uploadImage(filePath,fileName,fileType).then((data) => {
                                let file_model = JSON.parse(data.response);
                                console.log('uploadResp:'+JSON.stringify(data));
                                let addFile: any = { path: filePath, data: file_model, name: file_model.name,isMy: true };
                                addFile.type = 'image';
                                
                                console.log('uploadFileshow:',addFile);
                                let location: any = new String(file_model.name);
                                let point = location.lastIndexOf(".");
                                let type = location.substring(point+1).toLocaleLowerCase();
                                if(!this.filterFileType(type,judge,field)){
                                    this.uploadClickCount--;
                                    field.uploadShow = true
                                    return ;
                                }
                                addFile.type = 'file';
                                if (type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'gif' || type === 'bmp'){
                                    addFile.type = 'image';
                                }
                                this.profileFile[this.profileFile.length] = addFile;
                                this.files.push(file_model);
                                console.log('上传图片成功变量：'+field.name);
                                console.log('上传图片成功：'+JSON.stringify(this.files));
                    
                                let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);
                    
                                this.uploadImg.copyFile(filePath, newFileName, null, null);
                    
                            }, (err) => {
                                this.uploadShow = true;
                                this.uploadClickCount --;
                              console.log('chooseFile-error:' + err);
                            });
        
                   });
                } else {
                  console.log('fileChoose1:'+uri);
                  let path:any = new String(uri);
                  let fileName = path.substring(path.lastIndexOf('/')+1, path.length);
                    fileName = decodeURIComponent(fileName);
                  let fileName2:any = new String(fileName);
                  let fileType = fileName2.substring(fileName2.lastIndexOf('.')+1, fileName2.length);
    
                  let location:any = new String(uri);
                  let point = location.lastIndexOf("."); 
            
                    let type = location.substring(point+1).toLocaleLowerCase();
                    if(!this.filterFileType(type,judge,field)){
                        this.uploadClickCount--;
                        this.uploadShow = true
                        return ;
                    }
                    

                  console.log('fileChoose2:'+uri);
                    fileType = AppGlobal.getInstance().fileIMMEType[fileType];
                    this.uploadImg.uploadImage(uri, fileName, fileType).then((data) => {
                        let file_model = JSON.parse(data.response);
                        console.log('uploadResp:'+JSON.stringify(data));
                        let addFile:any = {path:uri, data:file_model, name:fileName};
                        addFile.type = 'file';
                        if (type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'gif' || type === 'bmp'){
                            addFile.type = 'image';
                        }
                        console.log('uploadFileshow:'+JSON.stringify(addFile));
                        this.profileFile[this.profileFile.length] = addFile;
                        this.files.push(file_model);
                        console.log('上传图片成功变量：'+field.name);
                        console.log('上传图片成功：'+JSON.stringify(this.files));

                        let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);
                        this.uploadImg.copyFile(uri, newFileName, null, null);
                    }, (err) => {
                       this.uploadShow = true;
                       this.uploadClickCount --;
                        console.log('chooseFile-error:' + err);
                    });
                }
          })
          .catch(error => {
              AppGlobal.getInstance().flag = '';
              console.log('chooseFile-error:' + error);
          });
    }

    webChooseFile(event, field){
        if (field) {
            if (Camera['installed']()) {
                this.chooseFile(event, field,false);
            } else {
                this.addCommentFileInput.nativeElement.setAttribute('data', JSON.stringify(field));
                this.addCommentFileInput.nativeElement.click();
            }
        } else {
            let alert = this.alertCtrl.create({
                title: "发生错误",
                buttons: ['确认']
            });
            alert.present();
        }
    }
    filterFileType(type,judge,field){
        type = type.toLocaleLowerCase();
        console.log("filterFileType type="+type);
        if (type != 'jpg' && type != 'jpeg' && type != 'png' && type != 'gif' && type != 'bmp' && type != 'txt' && type != 'wps' && type != 'rtf' && type != 'doc' && type != 'docx' && type != 'xls' && type != 'xlsx' && type != 'ppt' && type != 'pptx' && type != 'pdf' && type != 'rar' && type != 'zip' && type != 'gz' && type != 'rm' && type != 'avi' && type != 'wma' && type != 'mp3' && type != 'mpg'&& type != 'mp4' && type != 'mov') {
            let alert = this.alertCtrl.create({
                title: '只能上传指定后缀文件类型：jpg、jpeg、png、gif、bmp、txt、wps、rtf、doc、docx、xls、xlsx、ppt、pptx、pdf、rar、zip、gz、rm、avi、wma、mp3、mp4、mpg、mov',
                buttons: ['确认']
            });
            alert.present();
            return false;
        }
        let fileType = type,filterType = 1;
        if(judge){//对上传文件类型做限制
            if(fileType === 'txt' || fileType === 'wps' || fileType === 'rtf' || fileType === 'doc' || fileType === 'docx' || fileType === 'xls' || fileType === 'xlsx' || fileType === 'ppt' || fileType === 'pptx' || fileType === 'pdf'){
                filterType = 1;
            }else if(fileType === 'avi' || fileType === 'wma' || fileType === 'mp3'|| fileType === 'mp4'|| fileType === 'mov'){
                filterType = 2;
            }else if (type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'gif' || type === 'bmp'){
                filterType = 3;
            }else {
                return false;
            }
            if (filterType===1 && !field.controlSetting.textType) {
                let alert = this.alertCtrl.create({
                    title: '不能上传文本类型文件',
                    buttons: ['确认']
                });
                alert.present();
                return false;
            } else if (filterType===2 && !field.controlSetting.videoType) {
                let alert = this.alertCtrl.create({
                    title: '不能上传音频类型文件',
                    buttons: ['确认']
                });
                alert.present();
                return false;
            }else if(filterType===3 && !field.controlSetting.imageType){
                let alert = this.alertCtrl.create({
                    title: '不能上传图片',
                    buttons: ['确认']
                });
                alert.present();
                return false;
            }
        }
        return true;
    }

    processWebImage(event) {
        let reader = new FileReader();
        reader.readAsDataURL(event.target.files[0]);
        let fieldData: any = this.addCommentFileInput.nativeElement.getAttribute('data');
        let field: any = JSON.parse(fieldData);
        this.uploadClickCount = this.uploadClickCount + 1;

        this.isHideUploadButton(field);
        
        console.log('processWebImage-------------into');

        let file = event.target.files[0];
        console.log(file);
        reader.onload = (readerEvent) => {
            let showImg = (readerEvent.target as any).result;

            let path = AppGlobal.getInstance().OPERATION_URL + "/operation/api/attachment/upload";
            this.serviceOrderData.uploadFileByWeb(path, file, file.name).then((data) => {

                let file_model = data;
                let fileType = 'file';

                if (file.type.indexOf('image') > -1) {
                    fileType = 'image';
                }
                let judge = field.controlSetting.constraint;
                let location: any = new String(data.name);
                let point = location.lastIndexOf(".");
                let type = location.substring(point+1).toLocaleLowerCase();
                if(!this.filterFileType(type,judge,field)){
                    this.uploadClickCount--;
                    field.uploadShow = true
                    return ;
                }
                this.profileFile[this.profileFile.length] = { path: showImg, data: file_model, type: fileType, name: file.name };
                this.files.push(file_model);
                
                console.log('上传图片成功变量：' + field.name);
                console.log('上传图片成功：' + JSON.stringify(this.orderInstance[field.name]));

                this.addCommentFileInput.nativeElement.value = "";
                this.addCommentFileInput.nativeElement.setAttribute('data', null);
            }, (err) => {
                this.uploadShow = true;
                this.uploadClickCount--;
                let alert = this.alertCtrl.create({
                    title: err,
                    buttons: ['确认']
                });
                alert.present();
            });
        };

    }

    delFile(fileInfo, field){
        if (fileInfo && field) {
            let fieldName:any;
            if(typeof field === 'object'){
                fieldName = field.name;
            } else if(typeof field === 'string'){
                fieldName = field;
            }

            for(let i = 0; i < this.files.length; i ++){
                let files = this.files;
                if(files[i].url === fileInfo.data.url){
                    files.splice(i, 1);
                     break;
                }
            }

            for(let i = 0; i < this.profileFile.length; i++){
                if(this.profileFile[i].path === fileInfo.path){
                    this.profileFile.splice(i, 1);
                     break;
                }
            }

            if(this.files.length != Number(field.controlSetting.fileNumber)){
                this.uploadShow = true;
                this.uploadClickCount  = this.profileFile.length;
            }
         }
    }

    showFile(fileInfo){
        AppGlobal.getInstance().flag="showFile";
        console.log('showFile:'+fileInfo.path);
        let path = fileInfo.path;
        let fileType = fileInfo.contentType; 
        this.fileOpener.open(path, AppGlobal.getInstance().fileIMMEType[fileType])
          .then(() => {console.log('File is opened');AppGlobal.getInstance().flag = '';})
          .catch(e => {
              AppGlobal.getInstance().flag = '';
              let alert = this.alertCtrl.create({
                    title: JSON.stringify(e),
                    buttons: ['确认']
                });
                alert.present();
          });
    }

    addComment() {
        if(!this.hideSubmit){
            this.hideSubmit = true;
            let commitData = this.form.value;
            commitData.classType = 'Comment';
            commitData.assocInstanceId = this.order.id;
            if(AppGlobal.getInstance().isIos){
                    commitData.commentSource = 2;
                } else {
                    commitData.commentSource = 3;
                }
            commitData.commentStatus = 1;
            commitData.commentUser = this.webUser.label;
            commitData.commentUserTenant = this.webUser.tenantId;
            commitData.formTenant = this.tenant;
            //this.form.platformName = this.webUser.company.platformName;
            if(this.files && this.files.length > 0){
              commitData.attachment = this.files;
            }
            commitData.isBelongClient = 2;
            commitData.commentUserAccount = this.webUser.account;
            commitData.commentUserSex = this.webUser.sex;
            commitData.commentUserPassportId = this.webUser.passportId;
            commitData.commentTime = new Date().getTime();
    
            console.log('addcommnet commit:'+JSON.stringify(commitData));
    
            this.serviceOrderData.addComment(commitData, this.tenant)
            .then(data => {
                  this.viewCtrl.dismiss();
              })
              .catch(error => {
                  console.error(error);
              });
        }
    }

    //动态设置textarea的高度
  changeTextHeight(flag :boolean = false){
    if(this.form.value.commentDescription.trim() != ""){
        this.hideSubmit = false;
    }else{
        this.hideSubmit = true;
    }
    let scrollHeight = 0;
    let inputDom = this.inputText['_native'].nativeElement
    this.renderer.setElementStyle(inputDom,'height','34px'); 
        scrollHeight = this.inputText['_native'].nativeElement.scrollHeight ;
    if(scrollHeight >= 120){
        scrollHeight = 120 
        this.renderer.setElementStyle(inputDom,'overflowY','auto')
    }else{
        this.renderer.setElementStyle(inputDom,'overflowY','hidden')
    }
        this.renderer.setElementStyle(inputDom,'height',scrollHeight + 'px');
        this.renderer.setElementStyle(inputDom.parentNode,'height',22 + scrollHeight + 'px')
    
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