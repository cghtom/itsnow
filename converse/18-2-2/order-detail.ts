/**
 * 工单详情及处理
 */

import { Component,ViewChild,ElementRef,Renderer, EventEmitter,Input} from '@angular/core';
import { NavParams,DateTime, Content,Navbar,NavController,
    Platform,ToastController,ViewController,normalizeURL,AlertController, 
    PopoverController,Events, ModalController,ActionSheetController, 
    LoadingController } from 'ionic-angular';
import { ServiceOrderData } from "../../../providers/serviceorder-data";
import moment from 'moment';
import uuidV1 from '../../../../node_modules/uuid';
import { FileOpener } from '@ionic-native/file-opener';
import { File } from '@ionic-native/file';
import { AppGlobal } from "../../../app/app.global";
import { ServiceOrderCommentPage } from "./order-comment";

import { PopoverPage } from './order-select';
import { AddCommentPage } from './order-addcomment';
import { FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { OrderReferenceSelectPage } from "../order-detail/order-referenceselect";
import { PhotoViewer } from '@ionic-native/photo-viewer';
import { UploadImg } from "../../../providers/upload-img";
import { OrderRelOrdersSelectPage } from "../order-detail/order-relorderselect";
import { OrderResourceSelectPage} from "../order-detail/order-resourceselect";
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/forkJoin';
import { FileChooser } from '@ionic-native/file-chooser';
import { FilePath } from '@ionic-native/file-path';
import { OrderDetailService } from "./service/order-detailService";
import { ServiceOrderService } from "./service/order-serviceOrderService";
import { SendOrderService } from "./service/order-sendOrderService";
import { IncidentOrderService } from "./service/order-incidentOrderService";
import { Transfer } from "@ionic-native/transfer";
import { Camera } from '@ionic-native/camera';
import { ImageSlidesPage } from "../moment/image-slides";
import {OrderListPage} from "../order-list/order-list";
import {DomSanitizer} from '@angular/platform-browser';
import { NativeService } from "../../../providers/native-service";
import { UserData} from "../../../providers/user-data";
declare var cordova: any;
declare var pinyin:any;
declare var naturalComparator:any;

@Component({
    selector: 'page-order-detail',
    templateUrl: 'order-detail.html'
})
export class ServiceOrderDetailPage {

    @ViewChild('serviceCreateAll') reportInfoAll: ElementRef;
    @ViewChild('addOrderFileInput') addOrderFileInput;

    title: string = '工单';
    order: any;
    workflowTemplate: any;
    workflowTemplateDeployButton: any;
    orderTable: any;
    orderForm: any;
    workflowDefinition: any;
    readonly: boolean;
    submitted = false;
    workflowInstance: any;
    pathDefinitionProcesses: any;
    orderInstance: any;
    webUser: any;
    renderer: any;
    topButtons = [];
    saveButShow: boolean = true;
    taskNodeProcess: any;
    files = [];
    serviceOrderSourceEnum: any;
    replyInstance: any;
    commentSourceEnum: any;
    userServiceRole: boolean = false;
    form: FormGroup;
    el: any;
    tenant: any;
    addMessageBtn: boolean = true;
    profileFile: any = [];
    tempFile: any = {};
    uploadShow: boolean = true;
    uploadClickCount: number = 0;
    commentForm: any;
    serviceCatalogue = {
        'serviceOrder': 'serviceOrder',
        'sendOrder': 'sendOrder',
        'incidentOrder': 'operationOrder'
    };
    coordinationRequests: any;
    hideRun:boolean = false;
    isWeb: boolean = false;
    isHideDeal: boolean = false;
    comment:any = {};
    gtOneHide:boolean = false;
    dealInfo:string = "";
    constructor(public navParams: NavParams,
        public serviceOrderData: ServiceOrderData,
        public navCtrl: NavController,
        public events: Events,
        el: ElementRef,
        renderer: Renderer,
        public popoverCtrl: PopoverController,
        public modalCtrl: ModalController,
        public fb: FormBuilder,
        public loadingCtrl: LoadingController,
        public alertCtrl: AlertController,
        public uploadImg: UploadImg,
        private viewCtrl: ViewController,
        private fileOpener: FileOpener,
        private photoViewer: PhotoViewer,
        private fileChooser: FileChooser,
        private filePath: FilePath,
        private file: File,
        private transfer: Transfer,
        private toastCtrl: ToastController,
        public _DomSanitizer: DomSanitizer,
        public nativeService: NativeService,
        public actionSheetCtrl: ActionSheetController,
        public userService: UserData,
        public camera: Camera) {

        this.title = AppGlobal.getInstance().order_title;
        if (!File['installed']()) {
            this.isWeb = true;
        }
        this.el = el;
        this.renderer = renderer;
        //this.webUser = navParams.get('user');
        if (AppGlobal.getInstance().itsnowUser) {
            this.webUser = AppGlobal.getInstance().itsnowUser.userObj;
            this.tenant = AppGlobal.getInstance().itsnowUser.tenant;
            console.log('web user:', this.webUser);
        }
        this.hideRun = navParams.get('isRunHide');


        this.order = navParams.get('order');
        this.workflowTemplate = navParams.get('workflowTemplate');
        this.workflowTemplateDeployButton = navParams.get('workflowTemplateDeployButton');
        this.orderTable = navParams.get('orderTable');
        this.orderForm = navParams.get('orderForm');
        console.log('orderForm 数据:',this.orderForm);
        this.workflowDefinition = navParams.get('workflowDefinition');
        this.workflowInstance = navParams.get('workflowInstance');
        this.pathDefinitionProcesses = navParams.get('pathDefinitionProcesses');
        this.orderInstance = navParams.get('orderInstance');
        this.webUser = navParams.get('webUser');
        this.topButtons = navParams.get('topButtons');
        this.taskNodeProcess = navParams.get('taskNodeProcess');
        this.replyInstance = navParams.get('replyInstance');
        let fileDatas = navParams.get('profileFile');
        this.coordinationRequests = navParams.get('coordinationRequests');
        this.comment = navParams.get("comment");
        this.form = navParams.get('form');
        this.commentForm = navParams.get('commentForm');
        
        if ((!this.order) && AppGlobal.getInstance().order_type === 'serviceOrder') {
            let reportLabel = this.form.controls['reportLabel'].setValue(this.webUser.label);
            this.form.controls['reportPhone'].setValue(this.webUser.mobilePhoneNumber);
            this.form.controls['reportEmail'].setValue(this.webUser.email);
            if (this.webUser.company && this.webUser.company.label) {
                this.form.controls['reportCompany'].setValue(this.webUser.company.label);
            }
            this.orderInstance.reportUser = {
                id: this.webUser.id,
                label: this.webUser.label,
                classType: "User",
                passportId: this.webUser.passportId,
                accountType: this.webUser.accountType,
                tenantId: this.webUser.tenantId,
                account: this.webUser.account,
                base: "User"
            };

            this.form.controls['reportUser'].setValue(this.orderInstance.reportUser);
        }

        //派工单完成度设置
        if (AppGlobal.getInstance().order_type === 'sendOrder') {
            let workProgressType: any;
            let workProgress: any;
            for (let i in this.form.value) {

                if (i === 'workProgressType') {
                    workProgressType = this.form.value[i];
                }

                if (i === 'workProgress') {
                    workProgress = this.form.value[i];
                }
            }
            if (workProgressType && (!workProgress)) {
                this.form.controls['workProgress'].setValue('100');
            }
          
        }

        if (!this.order) {
            this.readonly = false;
        } else {
            this.readonly = true;
        }

        if (this.order && this.order.progress === '结束') {
            this.addMessageBtn = false;
        }

        this.listenEvents();

        //因编辑页面存在可对上传进行编辑，所以此处判断是否上传的文件数量已达到不可上传数量
        this.orderForm.fields2.forEach(field => {
            if (field.childs && field.childs.length > 0) {
                field.childs.forEach(firstChild => {
                    if (firstChild.control === 'attachment2') {
                        this.buildAttachmentShow(firstChild);
                    }
                    if (firstChild.childs && firstChild.childs.length > 0) {
                        firstChild.childs.forEach(secondChild => {
                            if (secondChild.control === 'attachment2') {
                                this.buildAttachmentShow(secondChild);
                            }
                        });
                    }
                });
            }
        });
        //控制页面组建复用 comment-area 
        if(this.commentForm && this.commentForm.fields2 &&  this.commentForm.fields2.length>0)
        {
            this.gtOneHide = false;
            this.orderForm.fields2.forEach(field => {
                if (field.childs && field.childs.length > 0) {
                    field.childs.forEach(firstChild => {
                        
                        if (!firstChild.hidden && firstChild.control === 'comment-area') {
                            firstChild['childs'] = this.commentForm.fields2;
                            this.gtOneHideComment(field);
                            this.commentArea(firstChild);
                            this.buildAttachmentShow(firstChild);
                        }
    
                        if (firstChild.childs && firstChild.childs.length > 0) {
                            firstChild.childs.forEach(secondChild => {
                                if (!secondChild.hidden && secondChild.control === 'comment-area') {
                                    secondChild['childs'] = this.commentForm.fields2;
                                    this.gtOneHideComment(firstChild);
                                    this.commentArea(secondChild);
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    //当前页面只能显示一个处理信息（内部结构为：评论表单） ，多余一个隐藏
    gtOneHideComment(f){
        if(!f.hidden){
            if(!this.gtOneHide){
                // this.gtOneHide = true;
            }else{
                f.hidden = true;
            }
        }
    }

    ionViewWillUnload(){
        this.events.unsubscribe('addFile');
        this.events.unsubscribe('checkInputValue');
    }

    getFileNumber(field){
        let fileNumber = 0;
        if(!field.controlSetting.fileNumber){
            if(Number(field.controlSetting.fileNumber) <= 0){//0 上传文件不加限制 
                fileNumber = 0;
            }else{
                //undefined 默认为5
                fileNumber = 5;
            }
            
        }else if(Number(field.controlSetting.fileNumber) > 0) {//上传文件个数为：field.controlSetting.fileNumber
            fileNumber = Number(field.controlSetting.fileNumber);
        } else {//不是数字默认为5
            fileNumber = 5;
        }
        return fileNumber;
    }
   
    commIsHide(f,name,hidden){
        f.childs.forEach(field => {
            if (field.childs && field.childs.length > 0) {
                field.childs.forEach(firstChild => {
                    if (firstChild.control != 'layout') {
                        if(firstChild.name == name){
                            firstChild.hidden = hidden;
                        }
                    }
                    if (firstChild.childs && firstChild.childs.length > 0) {
                        firstChild.childs.forEach(secondChild => {
                            if (secondChild.control != 'layout') {
                                if(secondChild.name == name){
                                    secondChild.hidden = hidden;
                                }
                            }
                        });
                    }
                });
            }
        });
    }
    commentArea(f){
        f.childs.forEach(field => {
            if (field.childs && field.childs.length > 0) {
                field.childs.forEach(firstChild => {
                    if (firstChild.control != 'layout') {
                        if(firstChild.control === 'attachment2'){
                            firstChild.readonly = f.readonly;
                            this.bulidCommentField(firstChild);
                            if(this.comment){
                                this.orderInstance[firstChild.name] = this.comment[firstChild.name];
                            }
                        }
                        else{
                            if(this.comment){
                                this.dealInfo = this.comment[firstChild.name];
                                if(f.name == 'commentDescription'){
                                    f.dealInfo = this.dealInfo;
                                }
                                this.form.controls[firstChild.name].setValue(this.comment[firstChild.name]);
                                this.orderInstance[firstChild.name] = this.comment[firstChild.name];
                            }
                        }
                    }
                    if (firstChild.childs && firstChild.childs.length > 0) {
                        firstChild.childs.forEach(secondChild => {
                            if (secondChild.control != 'layout') {
                                if(secondChild.control === 'attachment2'){
                                    secondChild.readonly = f.readonly;
                                    this.bulidCommentField(secondChild);
                                    if(this.comment){
                                        this.orderInstance[secondChild.name] = this.comment[secondChild.name];
                                    }
                                }
                                else{
                                    if(this.comment){
                                        this.dealInfo = this.comment[secondChild.name];
                                        if(f.name == 'commentDescription'){
                                            f.dealInfo = this.dealInfo;
                                        }
                                        this.form.controls[secondChild.name].setValue(this.comment[secondChild.name]);
                                        this.orderInstance[secondChild.name] = this.comment[secondChild.name];
                                    }
                                }
                            }
                        });
                    }
                });
            }
        });
    }
    
    buildAttachmentShow(child) {
        console.log("上传文件div,name:"+child.name+",label:"+child.label+",file size,"+child);
        child.uploadShow = true;
        if (child.upload) {//对上传文件不做限制 this.getFileNumber(child)=0 除外
            if (this.orderInstance && this.orderInstance[child.name] && this.orderInstance[child.name].length >= this.getFileNumber(child)&&this.getFileNumber(child)>0) {
                this.uploadShow = false;
                child.uploadShow = false;
            }
            console.log("可以上传文件");
        }
    }
    addOneUser(user,accountU,usersResult){
        if ((!accountU || user.account != accountU) && user.account) {
            let u = {"id":user.id,"label":user.label,'passportId':user.passportId};
            console.log(user.id+"--"+user.account);
            usersResult.set(user.account, u);
        }
    }
    assUsers(users,accountU,usersResult){
        if(users&&users.length>0){
            users.forEach((oneUser) => {
                this.addOneUser(oneUser,accountU,usersResult);
            });
        }
    }
    //遍历去重
    assUsersByType(one,accountU,usersResult){
        if(!one){
            return;
        }
        if(one["classType"] == "Role"){
            let roleGroups = one["groups"],roleUsers = one["users"];
            //单个角色用户组
            if(roleGroups&&roleGroups.length>0){
                roleGroups.forEach((child) => {
                    this.assUsers(child["users"],accountU,usersResult);
                });
            }
            // 单个角色用户
            this.assUsers(roleUsers,accountU,usersResult);
        }else if(one['classType'] == 'User'){
            //当前节点配置了的用户
            this.addOneUser(one,accountU,usersResult);
        }
       
    }
    commitTaskNode(button) {
        if(((!button.novalidate)&&(!this.form.valid)) || this.isCoordinationRequest()){//cgh7869
            return;
        }
        let result = this.compareTime();
        if (!result.succent){
            let alert = this.alertCtrl.create({
                title: result.error,
                buttons: ['确认']
            });
            alert.present();
            return;
        }
        console.log("commitTaskNode", button);
        console.log('workflowInstance', this.workflowInstance);
        console.log('order instance', this.orderInstance);
        console.log('web user', this.webUser);
        let loading;
        if (button.name != 'assign') {
            loading = this.loadingCtrl.create({
                spinner: 'bubbles',
                content: '保存中'
            });

            loading.present();

        }

        let that = this;

        try {
            if (button.local) {
                if (button.name === 'claim') {

                    this.serviceOrderData.operationTaskNodes(this.workflowInstance, button, "claimUserLabel=" + this.webUser.label, 'claim')
                        .then(data => {
                            loading.dismiss();
                            
                            this.navCtrl.pop();
                            
                        }).catch(error => {
                            console.error('commitTaskNode error', error);
                            
                            if (error && error.name && error.name === 'TimeoutError') {
                                this.navCtrl.pop();
                            } else {
                                loading.dismiss();
                                let alert = this.alertCtrl.create({
                                    title: '操作失败',
                                    buttons: ['确认']
                                });
                                alert.present();
                            }

                        });
                } else if (button.name === 'assign') {
                    //loading.dismiss();
                    //cgh7728
                    let allUsers: any = [],alert;
                   try{
                   
                    var roles = this.workflowInstance.currentTaskPersonnelRoles ? this.workflowInstance.currentTaskPersonnelRoles.split(',') : null;
                    var users = this.workflowInstance.currentTaskPersonnelUsers ? this.workflowInstance.currentTaskPersonnelUsers.split(',') : null;
                    var ruleUsers = this.workflowInstance.currentTaskPersonnelRuleUsers ? this.workflowInstance.currentTaskPersonnelRuleUsers.split(',') : null;
                    var array = [];
                    if (roles) {
                        for (var i = 0; i < roles.length; i++) {
                            array.push(this.serviceOrderData.requestCmdbApiCriteria("Role", "criteria", "associations=users,groups&where=name='" + roles[i] + "'"));
                        }
                    }
                    if (users) {
                        let u = [];
                        for (var l = 0; l < users.length; l++) {
                            if(!u[users[l]]){
                                console.log("id:"+users[l]);
                                array.push(this.serviceOrderData.requestCmdbApiCriteria("User", "criteria", "&where=passportId='" + users[l] + "'"));
                            }
                        }
                    }
                    if (ruleUsers) {
                        let u = [];
                        for (var q = 0; q < ruleUsers.length; q++) {
                            if(!u[ruleUsers[q]]){
                                console.log("id:"+ruleUsers[q]);
                                array.push(this.serviceOrderData.requestCmdbApiCriteria("User", "criteria", "&where=passportId='" + ruleUsers[q] + "'"));
                            }
                        }
                    }
                    console.log("add all http request to array end");
                    Observable.forkJoin(array).subscribe(res => {

                        let groups = [],usersResult = new Map(),accountU = this.webUser.account;
                        if(res&&res.length>0){
                            res.forEach((one) => { 
                                this.assUsersByType(one,accountU,usersResult);
                            });//cgh
                        }
                        
                        let checkOne = false;
                        if (usersResult.size == 0) {
                            var message = "";
                            if(!checkOne){//当前没人可选
                                message = "没有可分派的人";
                            }
                            let toast = this.toastCtrl.create({
                                message:message,
                                duration: 3000,
                                position: 'top'
                            });
                            toast.present();
                            return true;
                        }
                        allUsers = this.sortAddress(usersResult,"label");

                        alert = this.alertCtrl.create();
                        alert.setTitle('选择分派');
                        allUsers.forEach((user:any) => {
                            //需要遍历请求数组结果集，item便是一个请求返回的结果集
                            if(!checkOne){
                                alert.addInput({
                                    type: 'radio',
                                    label: user.label,
                                    value: user.id,
                                    checked: true
                                });
                                checkOne = true;
                            }else{
                                alert.addInput({
                                    type: 'radio',
                                    label: user.label,
                                    value: user.id,
                                    checked: false
                                });
                            }
                        });
                        alert.addButton('取消');
                        alert.addButton({
                            text: '确定',
                            handler: (data: any) => {
                                
                                let assignLoading = this.loadingCtrl.create({
                                    spinner: 'bubbles',
                                    content: '保存中'
                                });

                                assignLoading.present();

                                if (data && allUsers.length > 0) {
                                    for (let i in allUsers) {
                                        if (allUsers[i].id === data) {

                                            this.serviceOrderData.operationTaskNodes(this.workflowInstance, button, "accountPassportId=" + allUsers[i].passportId + "&accountLabel=" + allUsers[i].label, 'assign')
                                                .then(data => {
                                                    assignLoading.dismiss();
                                                    
                                                    this.navCtrl.pop();
                                                    
                                                }).catch(error => {
                                                    console.error('commitTaskNode error', error);

                                                    if (error && error.name && error.name === 'TimeoutError') {
                                                        this.navCtrl.pop();
                                                    } else {

                                                        assignLoading.dismiss();
                                                        let alert = this.alertCtrl.create({
                                                            title: '操作失败',
                                                            buttons: ['确认']
                                                        });
                                                        alert.present();
                                                    }
                                                });
                                            break;
                                        }
                                    }
                                }else{
                                    assignLoading.dismiss();
                                    this.navCtrl.pop();
                                }

                            }
                        });
                        alert.present();
                    });
                }catch(e){
                    console.error(new Date()+"-----",e);
                }
                }
            } else {

                let orderType = AppGlobal.getInstance().order_type;
                //if(orderType === 'serviceOrder'){
                let commitData = this.buildServiceOrderTaskNode(button);

                this.serviceOrderData.commitTaskNodesByServiceOrder(commitData, this.workflowInstance)
                    .then(data => {

                        console.log('commit task node res', data);
                        
                        loading.dismiss();
                        that.navCtrl.pop();

                    })
                    .catch(error => {
                        console.error('update order instance error', error);
                    })

            }
        } catch (error) {
            loading.dismiss();
            let alert = this.alertCtrl.create({
                title: '操作失败',
                buttons: ['确认']
            });
            alert.present();
        }
    }

    buildServiceOrderTaskNode(button) {

        let date = new Date();
        // this.orderInstance.updateUserLabel = this.webUser.label;
        // this.orderInstance.updateYear = date.getFullYear() + '';
        // this.orderInstance.updateMonth = date.getMonth() + 1 + '';
        // this.workflowInstance.updateUserLabel = this.webUser.label;
        // this.workflowInstance.updateYear = date.getFullYear() + '';
        // this.workflowInstance.updateMonth = date.getMonth() + 1 + '';

        for (let i in this.form.value) {

            if (i === 'commentDescription') {
                this.orderInstance[i] = this.form.value[i];
            } else {
                this.orderForm.fields.forEach(field => {
                    if (field.name === i) {
                        if (field.control === 'datetime') {
                            let time = this.form.value[i];
                            if (time){
                                if(typeof time === 'string'){
                                    this.orderInstance[i] = new Date(time.replace('T',' ').replace('Z','').replace('-','/').replace('-','/')).getTime();
                                } else if(typeof time === 'object'){
                                    //this.orderInstance[i] = new Date(this.form.value[i].year.value, this.form.value[i].month.value, this.form.value[i].day.value, this.form.value[i].hour.value, this.form.value[i].minute.value, 0).getTime();
                                    this.orderInstance[i] = new Date(this.form.value[i].year.value + "/" + this.form.value[i].month.value + "/" + this.form.value[i].day.value + " " + this.form.value[i].hour.value + ":"+ this.form.value[i].minute.value).getTime();

                                }  
                            } else {
                                if (field.required == true){
                                    this.orderInstance[i] = new Date().getTime();
                                }
                            }
                            //this.orderInstance[i] = new Date(this.form.value[i].year.value, this.form.value[i].month.value - 1, this.form.value[i].day.value, this.form.value[i].hour.value, this.form.value[i].minute.value, 0).getTime();
                        } else if (field.control != 'attachment2') {
                            this.orderInstance[i] = this.form.value[i];
                        }
                    }
                });
            }

        }

        let comment: any = null;
        if (this.orderInstance.commentDescription) {
            comment = {};

            comment.classType = 'Comment';
            comment.commentDescription = this.orderInstance.commentDescription;
            comment.assocInstanceId = this.order.id;
            comment.assocInstanceSubmitStatus = button.label,
                comment.assocInstanceStatus = this.workflowInstance.currentTaskName;
            if (AppGlobal.getInstance().isIos) {
                comment.commentSource = 2;
            } else {
                comment.commentSource = 3;
            }
            comment.commentStatus = 1;
            comment.commentUser = this.webUser.label;
            comment.commentUserTenant = this.webUser.tenantId;
            comment.formTenant = this.tenant;
            if (this.orderInstance['attachment'] && this.orderInstance['attachment'].length > 0) {
                comment.attachment = this.orderInstance['attachment'];
            }
            comment.isBelongClient = 2;
            comment.commentUserAccount = this.webUser.account;
            comment.commentUserSex = this.webUser.sex;
            comment.commentUserPassportId = this.webUser.passportId;
            comment.commentTime = new Date().getTime();

            this.orderInstance.commentObject = comment;
        }

        let commitData: any = { buttonName: button.name, buttonLabel: button.label, buttonVariableName: button.variableName };
        commitData.formInstance = this.orderInstance;
        commitData.commentObject = comment;
        commitData.workFlowInstanceId = this.workflowInstance.id;
        commitData.serviceCatalogue = this.serviceCatalogue[AppGlobal.getInstance().order_type];

        return commitData;
    }

    listenEvents() {

        this.events.subscribe('addFile', (file, field) => {
            let file_model = JSON.parse(file);
            /*
            if(AppGlobal.getInstance().order_type === 'serviceOrder'){
                this.files[this.files.length] = file_model;
            } else {
                this.orderInstance[field.name] = [file_model];
                console.log(this.orderInstance);
            }
            */
            if (this.orderInstance[field.name]) {
                this.orderInstance[field.name].push(file_model);
            } else {
                this.orderInstance[field.name] = [];
                this.orderInstance[field.name].push(file_model);
            }
            console.log('addorderInstance:' + JSON.stringify(file_model));

        });

        this.events.subscribe('checkInputValue', (value) => {
            let disabled = true;
            if (this.order) {
                if (value) {
                    this.topButtons.forEach(button => {
                        if (button.disabled) {
                            delete button.disabled;
                        }
                    });
                } else {
                    this.topButtons.forEach(button => {
                        button.disabled = button.initDisabledState;
                    });
                }
            }
        });

    }

    compareTime() {
        for (let i = 0;i<this.orderForm.fields.length;i++){
            if (this.orderForm.fields[i].control === 'datetime' && this.form.controls[this.orderForm.fields[i].name] && this.form.controls[this.orderForm.fields[i].name].value) {
                let selectTimeVal = this.form.controls[this.orderForm.fields[i].name].value;
                let selectTime;
                if(typeof selectTimeVal === 'string'){
                    selectTime = new Date(selectTimeVal.replace('T',' ').replace('Z','').replace('-','/').replace('-','/')).getTime();
                } else if (typeof selectTimeVal === 'object') {
                    selectTime = new Date(selectTimeVal.year.value + "/" + selectTimeVal.month.value + "/" + selectTimeVal.day.value + " " + selectTimeVal.hour.value + ":"+ selectTimeVal.minute.value).getTime();
                }
                if (this.orderForm.fields[i].controlSetting.maxDateProperty) {
                        let timeVal;let proTime;
                        if (this.orderForm.fields[i].controlSetting.maxDateProperty != 'currentTime') {
                            timeVal = this.form.controls[this.orderForm.fields[i].controlSetting.maxDateProperty].value;
                            if(typeof timeVal === 'string'){
                                proTime = new Date(timeVal.replace('T',' ').replace('Z','').replace('-','/').replace('-','/')).getTime();
                            } else if (typeof timeVal === 'object') {
                                proTime = new Date(timeVal.year.value + "/" + timeVal.month.value + "/" + timeVal.day.value + " " + timeVal.hour.value + ":"+ timeVal.minute.value).getTime();
                            }
                        } else {
                            proTime = new Date().getTime();
                        }
                        if (selectTime > proTime) {
                            return {
                                succent : false,
                                error : this.orderForm.fields[i].label + "大于" + this.getFieldsLabel(this.orderForm.fields[i].controlSetting.maxDateProperty)
                             };
                        }
                }

                if (this.orderForm.fields[i].controlSetting.minDateProperty) {
                    let timeVal;let proTime;
                    if (this.orderForm.fields[i].controlSetting.minDateProperty != 'currentTime') {
                        timeVal = this.form.controls[this.orderForm.fields[i].controlSetting.minDateProperty].value;
                        if(typeof timeVal === 'string'){
                            proTime = new Date(timeVal.replace('T',' ').replace('Z','').replace('-','/').replace('-','/')).getTime();
                        } else if (typeof timeVal === 'object') {
                            proTime = new Date(timeVal.year.value + "/" + timeVal.month.value + "/" + timeVal.day.value + " " + timeVal.hour.value + ":"+ timeVal.minute.value).getTime();
                        }
                    } else {
                        proTime = new Date().getTime();
                    }
                    if (selectTime < proTime) {
                         return {
                            succent : false,
                            error : this.orderForm.fields[i].label + "小于" + this.getFieldsLabel(this.orderForm.fields[i].controlSetting.minDateProperty)
                         };
                    }
                }
            } 
        }
         return {
            succent : true,
            error : ""
         };
    }

    getFieldsLabel(dateProperty){
        for (let j = 0;j<this.orderForm.fields.length;j++){
            if (this.orderForm.fields[j].name === dateProperty){
                return this.orderForm.fields[j].label;
            }
        }
        if (dateProperty === "currentTime"){
            return "当前时间";
        }
        return "";
    }

    onSubmit() {
        if(!this.form.valid){//cgh7869
            return;
        }
        let result = this.compareTime();
        if (!result.succent){
            let alert = this.alertCtrl.create({
                title: result.error,
                buttons: ['确认']
            });
            alert.present();
            return;
        }
        this.submitted = true;

        this.initOrder();

        this.orderForm.fields.forEach(field => {
            if (field.control == "sequence-id") {
                this.serviceOrderData.getNextSerialNumber(this.workflowTemplate.formClassType, field.bindProperty, field.controlSetting.prefix || "", field.controlSetting.zerofill ? (field.controlSetting.numberSize || 0) : 0)
                    .then(data => {
                        if(data){
                            this.orderInstance[field.bindProperty] = data;

                            console.log(this.orderInstance);
    
                            let orderType = AppGlobal.getInstance().order_type;
                            this.commitServiceOrder();
                        } else {
                            let toast = this.toastCtrl.create({
                                message: '提交发生错误',
                                duration: 3000,
                                position: 'bottom'
                              });
                        
                              toast.present();
                        }
                        
                    })
                    .catch(error => {
                        console.log('获取SerialNumber发生错误'+JSON.stringify(error));
                        let toast = this.toastCtrl.create({
                            message: '提交发生错误',
                            duration: 3000,
                            position: 'bottom'
                        });
                    
                        toast.present();
                    });

            }
        });

    }

    commitServiceOrder() {
        let loading = this.loadingCtrl.create({
            spinner: 'bubbles',
            content: '保存中'
        });

        loading.present();
        this.initWorkflow();
        if (!this.workflowTemplateDeployButton) {
            this.workflowTemplateDeployButton = this.getCommitPathButton(this.workflowTemplate);
        }

        let that = this;
       
        this.serviceOrderData.commitServiceOrderInstance(this.orderInstance, this.workflowInstance, this.workflowTemplateDeployButton,this.serviceCatalogue[AppGlobal.getInstance().order_type])
            .then(data => {
                console.log('deploy data', data);
                loading.dismiss();
                console.log("coomit------:", this.navCtrl.getActive());
                
                this.navCtrl.pop();

            }).catch(error => {
                try {
                    console.log('commitServiceOrder error:' + error);
                    console.log('commitServiceOrder error:' + JSON.stringify(error));
                } catch (error) {

                }

                loading.dismiss();

                if (error && error.name && error.name === 'TimeoutError') {
                    this.navCtrl.pop();
                } else {
                    let message = "创建失败";
                    if (error && error._body) {
                        try {
                            let body = JSON.parse(error._body);
                            if (body && body.message) {
                                message = body.message;
                            }
                        } catch (error) {
                            message = "创建失败";
                        }
                    }

                    let alert = this.alertCtrl.create({
                        title: message,
                        buttons: ['确认']
                    });
                    alert.present();
                    console.error(error);
                }

            });
    }

    getCommitPathButton(workflowDefinition) {
        if (workflowDefinition && workflowDefinition.pathDefinitions && workflowDefinition.taskNodes) {
            for (var j = 0; j < workflowDefinition.taskNodes.length; j++) {
                if (workflowDefinition.taskNodes[j].type == "startEvent") {
                    for (var i = 0; i < workflowDefinition.pathDefinitions.length; i++) {
                        if (workflowDefinition.pathDefinitions[i].fromId == workflowDefinition.taskNodes[j].name) {
                            return workflowDefinition.pathDefinitions[i];
                        }
                    }
                }
            }
        }
        return null;
    }

    initOrder() {
        let date = new Date();
        let user = AppGlobal.getInstance().itsnowUser;
        if (user) {
            console.log('itsnow user', user);
        }
        console.log('orderInstance1', this.orderInstance);
        this.orderInstance.classType = this.workflowTemplate.formClassType;
        // this.orderInstance.createUserRef = {
        //     id: user.userObj.id,
        //     label: user.label,
        //     account: user.userObj.account,
        //     classType: "User"
        // };
        // this.orderInstance.activity = 0;
        // this.orderInstance.progress = "草稿";
        // this.orderInstance.currentTaskHandlePersonnel = user.label;
        // this.orderInstance.associationService = this.workflowTemplate.assocId;
        // this.orderInstance.createYear = date.getFullYear() + '';
        // this.orderInstance.createMonth = date.getMonth() + 1 + '';
        // this.orderInstance.updateYear = date.getFullYear() + '';
        // this.orderInstance.updateMonth = date.getMonth() + 1 + '';
        // this.orderInstance.createUserLabel = user.label;
        // this.orderInstance.updateUserLabel = user.label;
        this.orderInstance.source = 4;
        //this.orderInstance.sourceData = this.files;

        for (let i in this.form.value) {
            this.orderForm.fields.forEach(field => {
                if (field.name === i) {
                    if (field.control === 'datetime') {
                        let time = this.form.value[i];
                        if (time){
                            if(typeof time === 'string'){
                                // let time = moment(this.form.value[i]).subtract(8, 'h').format('YYYY-MM-DD HH:mm:ss')
                                // this.orderInstance[i] = new Date(time).getTime();
                                //let time = moment(this.form.value[i]).subtract(8, 'h').format('YYYY-MM-DD HH:mm:ss')
                                this.orderInstance[i] = new Date(time.replace('T',' ').replace('Z','').replace('-','/').replace('-','/')).getTime();
                            } else if(typeof time === 'object'){
                                //this.orderInstance[i] = new Date(this.form.value[i].year.value, this.form.value[i].month.value, this.form.value[i].day.value, this.form.value[i].hour.value, this.form.value[i].minute.value, 0).getTime();
                                this.orderInstance[i] = new Date(this.form.value[i].year.value + "/" + this.form.value[i].month.value + "/" + this.form.value[i].day.value + " " + this.form.value[i].hour.value + ":"+ this.form.value[i].minute.value).getTime();
                            }  
                        } else {
                            if (field.required == true){
                                this.orderInstance[i] = new Date().getTime();
                            }
                        }
                        console.log(i + ':'+ this.orderInstance[i]);
                    } else if (field.control != 'attachment2') {
                        console.log('field name:' + field.name + ' i:' + i + ' value:' + this.form.value[i]);
                        this.orderInstance[i] = this.form.value[i];
                    }
                }
            });
        }

        //this.orderInstance.sessionId = '会话Id';
        console.log('orderInstance4:' + JSON.stringify(this.orderInstance));
    }

    initWorkflow() {
        let date = new Date();
        let user = AppGlobal.getInstance().itsnowUser;
        if (user) {
            console.log('itsnow user', user);
        }
        console.log('workflowInstance1', this.workflowInstance);
        this.workflowInstance.classType = "WorkflowProcess";
        this.workflowInstance.label = this.workflowTemplate.label;
        this.workflowInstance.name = uuidV1();
        this.workflowInstance.formName = this.workflowTemplate.formName;
        this.workflowInstance.formInstanceClassType = this.workflowTemplate.formClassType;
        this.workflowInstance.activitiId = this.workflowTemplate.activitiId;
        this.workflowInstance.workflowTemplateName = this.workflowTemplate.name;
        this.workflowInstance.workflowTemplateId = this.workflowTemplate.id;
        this.workflowInstance.workflowTemplateLabel = this.workflowTemplate.label;
        this.workflowInstance.formLabel = this.orderInstance.label;
        this.workflowInstance.serialNumber = this.orderInstance.serialNumber;
        this.workflowInstance.content = this.orderInstance.content;
        this.workflowInstance.currentObjectForm = this.orderForm.name;
        this.workflowInstance.currentObjectClassType = this.orderTable.name;
        this.workflowInstance.currentObjectId = this.orderInstance.id;
        this.workflowInstance.activity = 0;
        this.workflowInstance.progress = "草稿";
        this.workflowInstance.currentTaskHandlePersonnel = user.label;
        this.workflowInstance.createUserLabel = user.label;
        this.workflowInstance.updateUserLabel = user.label;
        this.workflowInstance.associationService = this.workflowTemplate.assocId;
        this.workflowInstance.createYear = date.getFullYear() + '';
        this.workflowInstance.createMonth = date.getMonth() + 1 + '';
        this.workflowInstance.updateYear = date.getFullYear() + '';
        this.workflowInstance.updateMonth = date.getMonth() + 1 + '';
        this.workflowInstance.sessionId;
        console.log('workflowInstance2', this.workflowInstance);
    }



    openSelect(myEvent) {

        this.navCtrl.push(ServiceOrderCommentPage, {
            order: this.order,
            orderInstance: this.orderInstance,
            commentSourceEnum: this.commentSourceEnum
        });

        /*
       let popover = this.popoverCtrl.create(PopoverPage,{
             order: this.order,
             orderInstance: this.orderInstance,
             commentSourceEnum: this.commentSourceEnum
       });
       popover.present({
         ev: myEvent
       });*/
    }

    addMessage() {
        let profileModal = this.modalCtrl.create(AddCommentPage, {
            order: this.order,
            orderInstance: this.orderInstance,
            commentForm: this.commentForm
        }, {
                showBackdrop: false,
                enterAnimation: 'modal-slide-in',
                leaveAnimation: 'modal-slide-out'
            });
        profileModal.present();
    }
    requiredFieldsForm(fields,name,isRequired){
        try {
            fields.forEach(f => {
                    if(f.name == name){
                        f.required = isRequired;
                        if(isRequired){
                            this.form.controls[name].setValidators(Validators.compose(this.buildFormItem(f)));
                        }else{
                            this.form.controls[name].clearValidators();
                        }
                    }
                if(f.childs && f.childs.length > 0){
                    this.requiredFieldsForm(f.childs,name,isRequired);
                }
            });
        } catch (error) {
                
        }
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
            validate[validate.length] = Validators.required;
        }
        if (file.control == 'text' || file.control == 'textarea'){
            validate[validate.length] = Validators.pattern(/\S/);
        }
        else if(file.control === 'datetime'){
            validate[validate.length] = Validators.pattern(/(\d{4}-\d{2}-\d{2}\d{2}:\d{2}:\d{2})|(\d{2}-\d{2}\d{2}:\d{2}:\d{2})|(\d{2}:\d{2}:\d{2})/);
        }
        if(file.control === 'phone' && (!file.controlSetting.inputReg)){
            validate[validate.length] = Validators.pattern("1(3[0-9]|4[57]|5[0-35-9]|8[0-9]|7[0-9])\\d{8}");
        }

        if(file.control === 'email' && (!file.controlSetting.inputReg)){
            validate[validate.length] = Validators.pattern("[A-Za-z\\d]+([\-_\.][A-Za-z\\d]+)*@([A-Za-z\\d]+[\-\.])+[A-Za-z\\d]{2,5}");
        }
        return validate;
    }
    reportSwitchChange(event) {
        let isShow: boolean = !this.orderInstance.reportMode;
        if (isShow) {
            this.orderInstance.reportMode = true;

            //报告人信息补充
            let reportLabel = this.form.controls['reportLabel'].setValue(this.webUser.label);
            this.form.controls['reportPhone'].setValue(this.webUser.mobilePhoneNumber);
            this.form.controls['reportEmail'].setValue(this.webUser.email);
            if (this.webUser.company && this.webUser.company.label) {
                this.form.controls['reportCompany'].setValue(this.webUser.company.label);
            }
            this.orderInstance.reportUser = {
                id: this.webUser.id,
                label: this.webUser.label,
                classType: "User",
                passportId: this.webUser.passportId,
                accountType: this.webUser.accountType,
                tenantId: this.webUser.tenantId,
                account: this.webUser.account,
                base: "User"
            };

            //将代理人信息置空
            this.orderInstance.agentLabel = null;
            this.orderInstance.agentPhone = null;
            this.orderInstance.agentEmail = null;
            this.orderInstance.agentCompany = null;
            this.orderInstance.agentUser = null;

            let all = this.reportInfoAll.nativeElement.querySelector('#reportInfoAll');
            if (all) {
                this.renderer.setElementStyle(this.reportInfoAll.nativeElement.querySelector('#reportInfoAll'), 'display', 'none');
            }

        } else {
            this.orderInstance.reportMode = false;
            this.requiredFieldsForm(this.orderForm.fields2,'reportLabel',true);
            this.requiredFieldsForm(this.orderForm.fields2,'reportPhone',true);
            this.requiredFieldsForm(this.orderForm.fields2,'reportCompany',true);
            //报告人信息置空
            let reportLabel = this.form.controls['reportLabel'].setValue('');
            this.form.controls['reportPhone'].setValue('');
            this.form.controls['reportEmail'].setValue('');
            this.form.controls['reportCompany'].setValue('');
            delete this.form.controls['reportUser'];
            this.orderInstance.reportUser = null;

            //将代理人信息补充
            this.orderInstance.agentLabel = this.webUser.label;
            this.orderInstance.agentPhone = this.webUser.mobilePhoneNumber;
            this.orderInstance.agentEmail = this.webUser.email;
            if (this.webUser.company && this.webUser.company.label) {
                this.orderInstance.agentCompany = this.webUser.company.label;
            }
            this.orderInstance.agentUser = {
                id: this.webUser.id,
                label: this.webUser.label,
                classType: "User",
                passportId: this.webUser.passportId,
                accountType: this.webUser.accountType,
                tenantId: this.webUser.tenantId,
                account: this.webUser.account,
                base: "User"
            };

            let all = this.reportInfoAll.nativeElement.querySelector('#reportInfoAll');
            if (all) {
                this.renderer.setElementStyle(this.reportInfoAll.nativeElement.querySelector('#reportInfoAll'), 'display', 'block');
            }

        }
    }
    focusInput(event, field) {
        let value = event.currentTarget.value;
        this.moveEnd(event.currentTarget);
    }
    moveEnd(obj){
        try {
            obj.focus();
            var len = obj.value.length;
            if (typeof obj.selectionStart == 'number' && typeof obj.selectionEnd == 'number') {
                obj.selectionStart = obj.selectionEnd = len;
            }else{
                var sel = obj.createTextRange();
                sel.moveStart('character',len);
                sel.collapse();
                sel.select();
            }
        } catch (error) {
            
        }
    }
    blurInput(event, field) {
        let value = event.currentTarget.value;
        if (field.name === 'workProgress') {
            if (value === '0') {
                this.orderInstance.workProgressType = "not";
                this.form.controls['workProgressType'].setValue("not");
            }

            if (value === '100') {
                this.orderInstance.workProgressType = "full";
                this.form.controls['workProgressType'].setValue("full");
            }

            if (value === '0' || value === '100') {
                for (let i = 0; i < this.orderForm.fields2.length; i++) {
                    var field = this.orderForm.fields2[i];

                    for (let j = 0; j < field.childs.length; j++) {
                        let child = field.childs[j];

                        if (child.childs && child.childs.length > 0) {
                            for (let k = 0; k < child.childs.length; k++) {
                                let child2 = child.childs[k];

                                if (child2.bindProperty === "workProgress") {//工作完成度
                                    var workProgressField = child2;
                                    workProgressField.readonly = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    changSelect(event, field) {
        if (field.name === 'workProgressType') {
            let inputReadonly = true;

            if (event === 'full') {
                this.orderInstance.workProgress = 100;
                this.form.controls['workProgress'].setValue(100);
            }

            if (event === 'part') {
                this.orderInstance.workProgress = "50";
                this.form.controls['workProgress'].setValue("50");
                inputReadonly = false;
            }

            if (event === 'not') {
                this.orderInstance.workProgress = 0;
                this.form.controls['workProgress'].setValue(0);
            }

            for (let i = 0; i < this.orderForm.fields2.length; i++) {
                var field = this.orderForm.fields2[i];

                for (let j = 0; j < field.childs.length; j++) {
                    let child = field.childs[j];

                    if (child.childs && child.childs.length > 0) {
                        for (let k = 0; k < child.childs.length; k++) {
                            let child2 = child.childs[k];

                            if (child2.bindProperty === "workProgress") {//工作完成度
                                var workProgressField = child2;
                                workProgressField.readonly = inputReadonly;
                            }
                        }
                    }
                }
            }
        }

        if (field.name === 'emergencyLevel' || field.name === 'influenceLevel') {
            let emergencyLevel: any;
            let influenceLevel: any;
            this.orderInstance[field.name] = Number(event);
            if (field.name === 'emergencyLevel') {
                emergencyLevel = Number(event);
                influenceLevel = Number(this.form.controls['influenceLevel'].value);
            } else if (field.name === 'influenceLevel') {
                influenceLevel = Number(event);
                emergencyLevel = Number(this.form.controls['emergencyLevel'].value);
            }

            if (emergencyLevel == 2 && influenceLevel == 2) {
                this.form.controls['priority'].setValue(3);
                this.orderInstance.priority = 3;
            } else if (emergencyLevel == 1 && influenceLevel == 2) {
                this.form.controls['priority'].setValue(2);
                this.orderInstance.priority = 2;
            } else if (emergencyLevel == 0 && influenceLevel == 2) {
                this.form.controls['priority'].setValue(1);
                this.orderInstance.priority = 1;
            } else if (emergencyLevel == 2 && influenceLevel == 1) {
                this.form.controls['priority'].setValue(2);
                this.orderInstance.priority = 2;
            } else if (emergencyLevel == 1 && influenceLevel == 1) {
                this.form.controls['priority'].setValue(1);
                this.orderInstance.priority = 1;
            } else if (emergencyLevel == 0 && influenceLevel == 1) {
                this.form.controls['priority'].setValue(0);
                this.orderInstance.priority = 0;
            } else if (emergencyLevel == 2 && influenceLevel == 0) {
                this.form.controls['priority'].setValue(1);
                this.orderInstance.priority = 1;
            } else if (emergencyLevel == 1 && influenceLevel == 0) {
                this.form.controls['priority'].setValue(0);
                this.orderInstance.priority = 0;
            } else if (emergencyLevel == 0 && influenceLevel == 0) {
                this.form.controls['priority'].setValue(0);
                this.orderInstance.priority = 0;
            }
        }

    }

    // changTime(event: any, field) {
 
    //     let selectTime = new Date(event.year, event.month, event.day, event.hour, event.minute, 0).getTime();

    //     if (field.controlSetting.maxDateProperty) {
    //         let timeVal;
    //         if (field.controlSetting.maxDateProperty != 'currentTime') {
    //             timeVal = this.form.controls[field.controlSetting.maxDateProperty].value;
    //         } else {
    //             timeVal = this.getDateTimeValue();
    //         }
    //         let proTime;
    //         if(typeof timeVal === 'string'){
    //             proTime = new Date(timeVal).getTime();
    //         } else if (typeof timeVal === 'object') {
    //             proTime = new Date(timeVal.year.value, timeVal.month.value , timeVal.day.value, timeVal.hour.value, timeVal.minute.value, 0).getTime();
    //         }

    //         if (selectTime > proTime) {
    //             this.form.controls[field.name].setValue(null);
    //         }
    //     }

    //     if (field.controlSetting.minDateProperty) {
    //         let timeVal;
    //         if (field.controlSetting.minDateProperty != 'currentTime') {
    //             timeVal = this.form.controls[field.controlSetting.minDateProperty].value;
    //         } else {
    //             timeVal = this.getDateTimeValue();
    //         }
    //         let proTime;
    //         if(typeof timeVal === 'string'){
    //             proTime = new Date(timeVal).getTime();
    //         } else if (typeof timeVal === 'object') {
    //             proTime = new Date(timeVal.year.value, timeVal.month.value , timeVal.day.value, timeVal.hour.value, timeVal.minute.value, 0).getTime();
    //         }

    //         if (selectTime < proTime) {
    //             this.form.controls[field.name].setValue(null);
    //         }
    //     }
    //    // this.form.controls[field.name].setValue(showTime);
    // }

    getDateTimeValue() {
        let nowtime = new Date();
        let year = { columnIndex: 0, text: nowtime.getFullYear(), value: nowtime.getFullYear() };
        let month = { columnIndex: 1, text: nowtime.getMonth() + 1, value: nowtime.getMonth() + 1 };
        let day = { columnIndex: 2, text: nowtime.getDate(), value: nowtime.getDate() };
        let hour = { columnIndex: 3, text: nowtime.getHours(), value: nowtime.getHours() };
        let minute = { columnIndex: 4, text: nowtime.getMinutes(), value: nowtime.getMinutes() };
        let second = { columnIndex: 5, text: nowtime.getSeconds(), value: nowtime.getSeconds() };
        return { year: year, month: month, day: day, hour: hour, minute: minute, second: second };
    }

    getLongToString(t){
        let nowtime = new Date(t);
        let year = {columnIndex: 0, text: nowtime.getFullYear(), value: nowtime.getFullYear()};
        let month = {columnIndex: 1, text: nowtime.getMonth(), value : nowtime.getMonth()};
        let day = {columnIndex: 2, text: nowtime.getDate(), value: nowtime.getDate()};
        let hour = {columnIndex: 3, text: nowtime.getHours(), value: nowtime.getHours()};
        let minute = {columnIndex: 4, text: nowtime.getMinutes(), value: nowtime.getMinutes()};
        let second = {columnIndex: 5, text: nowtime.getSeconds(), value: nowtime.getSeconds()};
        console.log('--------time:'+nowtime.getFullYear() + '-' + nowtime.getMonth() + '-' + nowtime.getDate());
        return year + '-' + month + '-' + day + 'T' + hour + ':' + minute + ':' + second + ':00Z';
    }

    weakReferenceSelect(field) {
        if (field.controlSetting && field.controlSetting.refClassTypes && field.controlSetting.refClassTypes.length > 0) {
            let dataSelect = {};
            try{
                dataSelect = this.form.value[field.name];
            }catch(e){
            }
            let profileModal = this.modalCtrl.create(OrderReferenceSelectPage, {
                field: field,
                dataSelect:dataSelect
            }, {
                    showBackdrop: false,
                    enterAnimation: 'modal-slide-in',
                    leaveAnimation: 'modal-slide-out'
                });

            profileModal.present();

            profileModal.onDidDismiss((data: any) => {
                if (data) {

                    if (this.orderForm.bindType === 'OperationOrder') {
                        this.orderInstance[field.name] = {
                            id: data.id,
                            label: data.label,
                            classType: "User",
                            passportId: data.passportId,
                            accountType: data.accountType,
                            tenantId: data.tenantId,
                            account: data.account,
                            base: "User"
                        };
                        this.form.controls[field.name].setValue(this.orderInstance[field.name]);

                        this.serviceOrderData.requestCmdbApi('User', data.id, 'associations=company').then(result => {
                            if (result) {
                                this.orderInstance.reportCompany = result.company ? result.company.label : null;
                                this.orderInstance.reportPhone = result.mobilePhoneNumber;
                                this.orderInstance.reportEmail = result.email;
                                this.orderInstance.reportLabel = result.label;

                                this.form.controls['reportCompany'].setValue(this.orderInstance.reportCompany);
                                this.form.controls['reportPhone'].setValue(this.orderInstance.reportPhone);
                                this.form.controls['reportEmail'].setValue(this.orderInstance.reportEmail);
                                this.form.controls['reportLabel'].setValue(this.orderInstance.reportLabel);
                            }
                        })
                            .catch(error => {
                                console.error(error);
                                this.orderInstance.reportCompany = data.company ? data.company.label : null;
                                this.orderInstance.reportPhone = data.mobilePhoneNumber;
                                this.orderInstance.reportEmail = data.email;
                                this.orderInstance.reportLabel = data.label;

                                this.form.controls['reportCompany'].setValue(this.orderInstance.reportCompany);
                                this.form.controls['reportPhone'].setValue(this.orderInstance.reportPhone);
                                this.form.controls['reportEmail'].setValue(this.orderInstance.reportEmail);
                                this.form.controls['reportLabel'].setValue(this.orderInstance.reportLabel);
                            });

                    } else if (this.orderForm.bindType === 'ServiceOrder') {
                        if (field.name === 'reportUser') {
                            this.orderInstance[field.name] = {
                                id: data.id,
                                label: data.label,
                                classType: "User",
                                passportId: data.passportId,
                                accountType: data.accountType,
                                tenantId: data.tenantId,
                                account: data.account,
                                base: "User"
                            };
                            this.form.controls[field.name].setValue(this.orderInstance[field.name]);

                            this.serviceOrderData.requestCmdbApi('User', data.id, 'associations=company').then(result => {
                                if (result) {
                                    this.orderInstance.reportCompany = result.company ? result.company.label : null;
                                    this.orderInstance.reportPhone = result.mobilePhoneNumber;
                                    this.orderInstance.reportEmail = result.email;
                                    this.orderInstance.reportLabel = result.label;

                                    this.form.controls['reportCompany'].setValue(this.orderInstance.reportCompany);
                                    this.form.controls['reportPhone'].setValue(this.orderInstance.reportPhone);
                                    this.form.controls['reportEmail'].setValue(this.orderInstance.reportEmail);
                                    this.form.controls['reportLabel'].setValue(this.orderInstance.reportLabel);
                                }
                            })
                                .catch(error => {
                                    console.error(error);
                                    this.orderInstance.reportCompany = data.company ? data.company.label : null;
                                    this.orderInstance.reportPhone = data.mobilePhoneNumber;
                                    this.orderInstance.reportEmail = data.email;
                                    this.orderInstance.reportLabel = data.label;

                                    this.form.controls['reportCompany'].setValue(this.orderInstance.reportCompany);
                                    this.form.controls['reportPhone'].setValue(this.orderInstance.reportPhone);
                                    this.form.controls['reportEmail'].setValue(this.orderInstance.reportEmail);
                                    this.form.controls['reportLabel'].setValue(this.orderInstance.reportLabel);
                                });
                        } else if (field.name === 'agentUser') {
                            this.orderInstance[field.name] = {
                                id: data.id,
                                label: data.label,
                                classType: "User",
                                passportId: data.passportId,
                                accountType: data.accountType,
                                tenantId: data.tenantId,
                                account: data.account,
                                base: "User"
                            };
                            this.form.controls[field.name].setValue(this.orderInstance[field.name]);

                            this.serviceOrderData.requestCmdbApi('User', data.id, 'associations=company').then(result => {
                                if (result) {
                                    this.orderInstance.agentCompany = result.company ? result.company.label : null;
                                    this.orderInstance.agentPhone = result.mobilePhoneNumber;
                                    this.orderInstance.agentEmail = result.email;
                                    this.orderInstance.agentLabel = result.label;

                                    this.form.controls['agentCompany'].setValue(this.orderInstance.agentCompany);
                                    this.form.controls['agentPhone'].setValue(this.orderInstance.agentPhone);
                                    this.form.controls['agentEmail'].setValue(this.orderInstance.agentEmail);
                                    this.form.controls['agentLabel'].setValue(this.orderInstance.agentLabel);
                                }
                            })
                                .catch(error => {
                                    console.error(error);
                                    this.orderInstance.agentCompany = data.company ? data.company.label : null;
                                    this.orderInstance.agentPhone = data.mobilePhoneNumber;
                                    this.orderInstance.agentEmail = data.email;
                                    this.orderInstance.agentLabel = data.label;

                                    this.form.controls['agentCompany'].setValue(this.orderInstance.agentCompany);
                                    this.form.controls['agentPhone'].setValue(this.orderInstance.agentPhone);
                                    this.form.controls['agentEmail'].setValue(this.orderInstance.agentEmail);
                                    this.form.controls['agentLabel'].setValue(this.orderInstance.agentLabel);
                                });
                        } else {
                            this.orderInstance[field.name] = data;
                            this.form.controls[field.name].setValue(data);
                        }

                    } else {
                        this.orderInstance[field.name] = data;
                        this.form.controls[field.name].setValue(data);
                    }
                }
            });
        }

    }

    orderSelect(field) {
        if (field.controlSetting) {
            let relClassType: any = AppGlobal.getInstance().relClassType;
            if (relClassType == null || (relClassType && relClassType.length === 0)){
                this.serviceOrderData.getRelClassType("where=genre=1 and search=2&associations=categoryWorkflowTemplates")
                .then(relClassTypeData => {
                    console.log('relClassTypeData', relClassTypeData);
                    AppGlobal.getInstance().relClassType = relClassTypeData;
                    relClassType = relClassTypeData;
                    if (field.controlSetting.orderTypes && field.controlSetting.orderTypes.length > 0) {
                        relClassType = [];
                        for (let i = 0; i < field.controlSetting.orderTypes.length; i++) {
                            relClassType.push({
                                label: field.controlSetting.orderTypes[i].categoryLabel,
                                name: field.controlSetting.orderTypes[i].categoryName
                            });
                        }
                    }
                    try {
                        if (relClassType && relClassType.length === 1) {
                            let profileModal = this.modalCtrl.create(OrderRelOrdersSelectPage, {
                                field: field,
                                type: relClassType[0].name,
                                orderInstance: this.orderInstance,
                                order: this.order
                            }, {
                                    showBackdrop: false,
                                    enterAnimation: 'modal-slide-in',
                                    leaveAnimation: 'modal-slide-out'
                                });
        
                            profileModal.present();
        
                            profileModal.onDidDismiss((data: any) => {
                                if (data) {
                                    let value = this.orderInstance[field.name];
                                    if (value) {
                                        this.orderInstance[field.name] = value.concat(data);
                                    } else {
                                        this.orderInstance[field.name] = data;
                                    }
                                    this.form.controls[field.name].setValue(this.orderInstance[field.name]);
                                }
                            });
                        } else {
                            let alert = this.alertCtrl.create();
                            alert.setTitle('选择工单类型');
                            for (let i = 0; i < relClassType.length; i++) {
                                alert.addInput({
                                    type: 'radio',
                                    label: relClassType[i].label,
                                    value: relClassType[i].name,
                                    checked: false
                                });
                            }
        
                            alert.addButton('取消');
                            alert.addButton({
                                text: '确定',
                                handler: (data: any) => {
                                    console.log('Radio data:', data);
        
                                    let profileModal = this.modalCtrl.create(OrderRelOrdersSelectPage, {
                                        field: field,
                                        type: data,
                                        orderInstance: this.orderInstance,
                                        order: this.order
                                    }, {
                                            showBackdrop: false,
                                            enterAnimation: 'modal-slide-in',
                                            leaveAnimation: 'modal-slide-out'
                                        });
        
                                    profileModal.present();
        
                                    profileModal.onDidDismiss((data: any) => {
                                        if (data) {
        
                                            let value = this.orderInstance[field.name];
                                            if (value) {
        
                                                this.orderInstance[field.name] = value.concat(data);
                                            } else {
                                                this.orderInstance[field.name] = data;
                                            }
                                            this.form.controls[field.name].setValue(this.orderInstance[field.name]);
                                        }
                                    });
                                }
                            });
                            alert.present();
                        }
                    } catch (error) {
                        let alert = this.alertCtrl.create({
                            title: '发生错误',
                            buttons: ['确认']
                        });
                        alert.present();
                        return;
                    }
                }).catch(error => {
                    console.error('error', error);
                });
            } else {
                if (field.controlSetting.orderTypes && field.controlSetting.orderTypes.length > 0) {
                    relClassType = [];
                    for (let i = 0; i < field.controlSetting.orderTypes.length; i++) {
                        relClassType.push({
                            label: field.controlSetting.orderTypes[i].categoryLabel,
                            name: field.controlSetting.orderTypes[i].categoryName
                        });
                    }
                }
                try {
                    if (relClassType && relClassType.length === 1) {
                        let profileModal = this.modalCtrl.create(OrderRelOrdersSelectPage, {
                            field: field,
                            type: relClassType[0].name,
                            orderInstance: this.orderInstance,
                            order: this.order
                        }, {
                                showBackdrop: false,
                                enterAnimation: 'modal-slide-in',
                                leaveAnimation: 'modal-slide-out'
                            });
    
                        profileModal.present();
    
                        profileModal.onDidDismiss((data: any) => {
                            if (data) {
                                let value = this.orderInstance[field.name];
                                if (value) {
                                    this.orderInstance[field.name] = value.concat(data);
                                } else {
                                    this.orderInstance[field.name] = data;
                                }
                                this.form.controls[field.name].setValue(this.orderInstance[field.name]);
                            }
                        });
                    } else {
                        let alert = this.alertCtrl.create();
                        alert.setTitle('选择工单类型');
                        for (let i = 0; i < relClassType.length; i++) {
                            alert.addInput({
                                type: 'radio',
                                label: relClassType[i].label,
                                value: relClassType[i].name,
                                checked: false
                            });
                        }
    
                        alert.addButton('取消');
                        alert.addButton({
                            text: '确定',
                            handler: (data: any) => {
                                console.log('Radio data:', data);
    
                                let profileModal = this.modalCtrl.create(OrderRelOrdersSelectPage, {
                                    field: field,
                                    type: data,
                                    orderInstance: this.orderInstance,
                                    order: this.order
                                }, {
                                        showBackdrop: false,
                                        enterAnimation: 'modal-slide-in',
                                        leaveAnimation: 'modal-slide-out'
                                    });
    
                                profileModal.present();
    
                                profileModal.onDidDismiss((data: any) => {
                                    if (data) {
    
                                        let value = this.orderInstance[field.name];
                                        if (value) {
    
                                            this.orderInstance[field.name] = value.concat(data);
                                        } else {
                                            this.orderInstance[field.name] = data;
                                        }
                                        this.form.controls[field.name].setValue(this.orderInstance[field.name]);
                                    }
                                });
                            }
                        });
                        alert.present();
                    }
                } catch (error) {
                    let alert = this.alertCtrl.create({
                        title: '发生错误',
                        buttons: ['确认']
                    });
                    alert.present();
                    return;
                }
            }
        }
    }

    delOrder(field, order) {
        let value = this.orderInstance[field.name];
        if (order && value) {
            for (let i = 0; i < value.length; i++) {
                if (order.id === value[i].id && order.classType === value[i].classType) {
                    value.splice(i, 1);
                }
            }
        }

        this.form.controls[field.name].setValue(this.orderInstance[field.name]);
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
            console.log('uploadResp:' + JSON.stringify(data));
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
            this.tempFile = addFile;
            this.tempFile["uuid"] = field.uuid;
            this.addFieldFile(this.orderForm.fields2);

            if (this.orderInstance[field.name]) {
                this.orderInstance[field.name].push(file_model);
            } else {
                this.orderInstance[field.name] = [];
                this.orderInstance[field.name].push(file_model);
            }
            console.log('上传文件成功field.name：' + field.name);
            console.log('上传文件成功：' + JSON.stringify(this.orderInstance[field.name]));

            let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);

            console.log("--------newFileName:"+newFileName);
            this.uploadImg.copyFile(filePath, newFileName, null, null);

            AppGlobal.getInstance().flag = '';
        }, (err) => {
            AppGlobal.getInstance().flag = '';
            field.uploadShow = true;
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

                    this.initUploadClickCount(field);
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
                        field.uploadShow = true;
                        this.uploadClickCount--;
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

                    this.initUploadClickCount(field);
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
                        field.uploadShow = true;
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
                
                            this.initUploadClickCount(field);
                            this.uploadClickCount = this.uploadClickCount + 1;
                            this.isHideUploadButton(field);
                
                            this.uploadImg.cameraOrChoosePhoto(true).then((imageData) => {
                
                            console.error("takeCameras 拍照:", imageData);
                            this.uploadService(field,imageData, judge);
                
                            }, (err: any) => {
                            AppGlobal.getInstance().flag = '';
                            field.uploadShow = true;
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
                
                            this.initUploadClickCount(field);
                            this.uploadClickCount = this.uploadClickCount + 1;
                            this.isHideUploadButton(field);
                            
                            this.nativeService.captureVideo()
                            .then(res=>{
                                console.error('拍摄视频res',res);
                                AppGlobal.getInstance().flag = "";
                                this.uploadService(field,res.fileUri,judge);
                            }, (err: any) => {
                                AppGlobal.getInstance().flag = '';
                                field.uploadShow = true;
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

            console.log('takePhoto-imageData:' + imageData);
            this.initUploadClickCount(field);
            this.uploadClickCount = this.uploadClickCount + 1;
            this.isHideUploadButton(field);

            this.uploadImg.uploadImage(imageData).then((data) => {

                let file_model = JSON.parse(data.response);
                let dataFile: any = { path: imageData, data: file_model, type: 'image',isMy: true };
                this.tempFile = dataFile;
                this.tempFile["uuid"] = field.uuid;
                this.addFieldFile(this.orderForm.fields2);
                
                if (this.orderInstance[field.name]) {
                    this.orderInstance[field.name].push(file_model);
                } else {
                    this.orderInstance[field.name] = [];
                    this.orderInstance[field.name].push(file_model);
                }
                console.log('上传图片成功变量：' + field.name);
                console.log('上传图片成功：' + JSON.stringify(this.orderInstance[field.name]));

                let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);

                console.log("--------newFileName:"+newFileName);

                this.uploadImg.copyFile(imageData, newFileName, null, null);
                AppGlobal.getInstance().flag = '';

            }, (err) => {
                AppGlobal.getInstance().flag = '';
                field.uploadShow = true;
                this.uploadClickCount--;
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
        AppGlobal.getInstance().flag = "choosePhoto";
        judge = field.controlSetting.constraint;
        if ((judge) && !field.controlSetting.imageType) {
            let alert = this.alertCtrl.create({
                title: '不能上传图片',
                buttons: ['确认']
            });
            alert.present();
            return;
        }
        this.uploadImg.cameraOrChoosePhoto(false).then((imageData) => {
            this.initUploadClickCount(field);
            console.log('choosePhoto-imageData:' + imageData);
            this.uploadClickCount = this.uploadClickCount + 1;
            this.isHideUploadButton(field);

            this.uploadImg.uploadImage(imageData).then((data) => {
                console.log('上传图片111:',data);
                let file_model = JSON.parse(data.response);
                let location: any = new String(file_model.name);
                let point = location.lastIndexOf(".");
                let type = location.substring(point+1).toLocaleLowerCase();
                if(!this.filterFileType(type,judge,field)){
                    this.uploadClickCount--;
                    field.uploadShow = true;
                    return ;
                }
                this.tempFile = { path: imageData, data: file_model, type: 'image',isMy: true };
                this.tempFile.type = 'file';
                if (type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'gif' || type === 'bmp'){
                    this.tempFile.type = 'image';
                }
                this.tempFile["uuid"] = field.uuid;
                this.addFieldFile(this.orderForm.fields2);
                if (this.orderInstance[field.name]) {
                    this.orderInstance[field.name].push(file_model);
                } else {
                    this.orderInstance[field.name] = [];
                    this.orderInstance[field.name].push(file_model);
                }
                console.log('上传图片成功变量：' + field.name);
                console.log('上传图片成功：' + JSON.stringify(this.orderInstance[field.name]));

                let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);
                this.uploadImg.copyFile(imageData, newFileName, null, null);
                AppGlobal.getInstance().flag = '';
            }, (err) => {
                AppGlobal.getInstance().flag = '';
                field.uploadShow = true;
                this.uploadClickCount--;
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
                this.initUploadClickCount(field);
                this.uploadClickCount = this.uploadClickCount + 1;
                this.isHideUploadButton(field);
                if (uri.indexOf('content://') === 0) {
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
                                console.log("chooseFile 1913 fileName fileType undefined call upload img",e);
                                fileName = undefined;
                                fileType = undefined;
                            }
                            console.log("chooseFile 1925 filePath:"+filePath+",fileName:"+fileName+",fileType:"+fileType);
                            this.uploadImg.uploadImage(filePath,fileName,fileType).then((data) => {
                                let file_model = JSON.parse(data.response);
                                console.log('uploadResp:' + JSON.stringify(data));
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
                                this.tempFile = addFile;
                                this.tempFile["uuid"] = field.uuid;
                                this.addFieldFile(this.orderForm.fields2);

                                if (this.orderInstance[field.name]) {
                                    this.orderInstance[field.name].push(file_model);
                                } else {
                                    this.orderInstance[field.name] = [];
                                    this.orderInstance[field.name].push(file_model);
                                }
                                console.log('上传图片成功变量：' + field.name);
                                console.log('上传图片成功：' + JSON.stringify(this.orderInstance[field.name]));

                                let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);
    
                                console.log("--------newFileName:"+newFileName);
                                this.uploadImg.copyFile(filePath, newFileName, null, null);

                                AppGlobal.getInstance().flag = '';
                            }, (err) => {
                                AppGlobal.getInstance().flag = '';

                                field.uploadShow = true;
                                this.uploadClickCount--;
                                console.log('chooseFile-error:' + err);
                            });

                        });
                } else {
                    console.log('fileChoose1:' + uri);
                    let path: any = new String(uri);
                    let fileName = path.substring(path.lastIndexOf('/') + 1, path.length);
                    fileName = decodeURIComponent(fileName);
                    let fileName2: any = new String(fileName);
                    let fileType = fileName2.substring(fileName2.lastIndexOf('.') + 1, fileName2.length);

                    let location: any = new String(uri);
                    let point = location.lastIndexOf(".");

                    let type = location.substring(point+1).toLocaleLowerCase();
                    if(!this.filterFileType(type,judge,field)){
                        this.uploadClickCount--;
                        field.uploadShow = true
                        return ;
                    }
                    console.log('fileChoose2:' + uri);
                    fileType = AppGlobal.getInstance().fileIMMEType[fileType];
                    this.uploadImg.uploadImage(uri, fileName, fileType).then((data) => {
                        let file_model = JSON.parse(data.response);
                        console.log('uploadResp:' + JSON.stringify(data));
                        let addFile: any = { path: uri, data: file_model, name: fileName ,isMy: true};
                        addFile.type = 'file';
                        if (type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'gif' || type === 'bmp'){
                            addFile.type = 'image';
                        }

                        console.log('uploadFileshow:' + JSON.stringify(addFile));
                        this.profileFile[this.profileFile.length] = addFile;
                        this.tempFile = addFile;
                        this.tempFile["uuid"] = field.uuid;
                        this.addFieldFile(this.orderForm.fields2);
                        if (this.orderInstance[field.name]) {
                            this.orderInstance[field.name].push(file_model);
                        } else {
                            this.orderInstance[field.name] = [];
                            this.orderInstance[field.name].push(file_model);
                        }
                        console.log('上传图片成功变量：' + field.name);
                        console.log('上传图片成功：' + JSON.stringify(this.orderInstance[field.name]));

                        let newFileName = file_model.dir + file_model.name.substring(file_model.name.lastIndexOf('.'), file_model.name.length);
                        this.uploadImg.copyFile(uri, newFileName, null, null);

                        AppGlobal.getInstance().flag = '';
                    }, (err) => {
                        AppGlobal.getInstance().flag = '';

                        field.uploadShow = true;
                        this.uploadClickCount--;
                        console.log('chooseFile-error:' + err);
                    });
                }
            })
            .catch(error => {
                AppGlobal.getInstance().flag = '';
                console.log('chooseFile-error:' + error);
            });
    }
   
    chooseWebFile(event, field) {
        if (field) {
            if (Camera['installed']()) {
                this.chooseFile(event, field,false);
            } else {
                this.addOrderFileInput.nativeElement.setAttribute('data', JSON.stringify(field));
                this.addOrderFileInput.nativeElement.click();
            }
        } else {
            let alert = this.alertCtrl.create({
                title: "发生错误",
                buttons: ['确认']
            });
            alert.present();
        }

    }
    addFile(element){
        //cgh1112
        if (element.uuid === this.tempFile["uuid"]) {
            if(element.filedatas&&element.filedatas.length>0){
                element.filedatas.push(this.tempFile);
                this.isHideUploadButton(element);
                this.tempFile = {};
            }else{
                element.filedatas = [];
                element.filedatas.push(this.tempFile);
                this.isHideUploadButton(element);
                this.tempFile = {};
            }        
        }
    }
    addFieldFile(field){
        //cgh1112
        if(this.tempFile&&this.tempFile.uuid){
            field.forEach((element:any) => {
                this.addFile(element);
                if (element.childs && element.childs.length > 0) {
                    this.addFieldFile(element.childs);
                }
            });
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

    processWebImage(event,field) {
        let reader = new FileReader();
        reader.readAsDataURL(event.target.files[0]);
        let fieldData: any = this.addOrderFileInput.nativeElement.getAttribute('data');
        field = JSON.parse(fieldData);
        this.initUploadClickCount(field);
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
                let dataFile: any = { path: showImg, data: file_model, type: fileType, name: file.name,isMy: true };
                this.tempFile = dataFile;
                this.tempFile["uuid"] = field.uuid;
                this.addFieldFile(this.orderForm.fields2);
                
                if (this.orderInstance[field.name]) {
                    this.orderInstance[field.name].push(file_model);
                } else {
                    this.orderInstance[field.name] = [];
                    this.orderInstance[field.name].push(file_model);
                }                
                console.log('上传图片成功变量：' + field.name);
                console.log('上传图片成功：' + JSON.stringify(this.orderInstance[field.name]));
                
                this.addOrderFileInput.nativeElement.value = "";
                this.addOrderFileInput.nativeElement.setAttribute('data', null);
            }, (err) => {
                field.uploadShow = true;
                this.uploadClickCount--;
                let alert = this.alertCtrl.create({
                    title: err,
                    buttons: ['确认']
                });
                alert.present();
            });
        };

    }
    
    //删除和选择文件上传时判断是否隐藏上传按钮
   isHideUploadButton(field){
       //cgh1112
        if(!field.controlSetting.fileNumber){
            if(Number(field.controlSetting.fileNumber) <= 0){//0 上传文件不加限制 
                this.uploadShow = true; 
                field.uploadShow = true;
            }else{
                //undefined 默认为5
                if (this.uploadClickCount >= 5) {
                    this.uploadShow = false;
                    field.uploadShow = false;
                }else{
                    this.uploadShow = true;  
                    field.uploadShow = true;
                }
            }
            
        }else if(Number(field.controlSetting.fileNumber) > 0) {//上传文件个数为：field.controlSetting.fileNumber
            if (this.uploadClickCount >= Number(field.controlSetting.fileNumber)) {
                console.log("隐藏附件");
                this.uploadShow = false;
                field.uploadShow = false;
            }else{
                console.log("显示附件");
                this.uploadShow = true; 
                field.uploadShow = true;
            }
        }else{
            //配置错误 默认为5
            if (this.uploadClickCount >= 5) {
                this.uploadShow = false;
                field.uploadShow = false;
            }else{
                this.uploadShow = true;  
                field.uploadShow = true;
            }
        }
    }
    initUploadClickCount (field){
        // cgh1112
        if (field) {
            let fieldName: any;
            if (typeof field === 'object') {
                fieldName = field.name;
            } else if (typeof field === 'string') {
                fieldName = field;
            }
            let fileNum = 0,num = 0;
            if(this.orderInstance[fieldName]&&this.orderInstance[fieldName].length&&this.orderInstance[fieldName].length>0){
                fileNum = this.orderInstance[fieldName].length;
            }
            try{
                if(!field["filedatas"] || field['filedatas'].length==0){
                    field.filedatas = [];
                }
                num = field.filedatas.length;
            }catch(e){
                num = 0;
            }
            if(fileNum>0){
                fileNum = fileNum>num?num:fileNum;
            }else{
                fileNum = num;
            }
            this.uploadClickCount = fileNum;
        }
    }
    delFile(fileInfo, field) {
        //cgh1112
        if (fileInfo && field) {
            let fieldName: any;
            if (typeof field === 'object') {
                fieldName = field.name;
            } else if (typeof field === 'string') {
                fieldName = field;
            }
            
            let fileNum = 0;
            if(this.orderInstance[fieldName]){
                for (let i = 0; i < this.orderInstance[fieldName].length; i++) {
                    let files = this.orderInstance[fieldName];
                    if (files[i].url === fileInfo.data.url) {
                        files.splice(i, 1);
                        break;
                    }
                }
                fileNum = this.orderInstance[fieldName].length;
            }
            if(field.filedatas&&field.filedatas.length>0){
                for (let i = 0,len = field.filedatas.length;i<len; i++) {
                    if (field.filedatas[i].data.url === fileInfo.data.url) {
                        field.filedatas.splice(i, 1);
                        break;
                    }
                }
            }else{
                field.filedatas = [];
            }
            if(fileNum>0){
                fileNum = fileNum>field.filedatas.length?field.filedatas.length:fileNum;
            }else{
                fileNum = field.filedatas.length;
            }
            if (typeof field === 'object' ) {
                this.uploadClickCount = fileNum;
                this.isHideUploadButton(field);
            } else {
                this.uploadShow = true;
                this.uploadClickCount = fileNum;
            }
        }

    }

    showFile(fileInfo) {
        //cgh1112
        if(!fileInfo|| fileInfo.isWeb || this.isWeb){
            return false;
        }
        AppGlobal.getInstance().flag = "showFile";
        console.log('showFile:' + fileInfo.path);
        let path = fileInfo.path;
        let fileType = fileInfo.contentType;
        this.fileOpener.open(path, AppGlobal.getInstance().fileIMMEType[fileType])
            .then(() => {AppGlobal.getInstance().flag = '';console.log('File is opened')})
            .catch(e => {
                AppGlobal.getInstance().flag = '';
                let alert = this.alertCtrl.create({
                    title: JSON.stringify(e),
                    buttons: ['确认']
                });
                alert.present();
            });
    }

    showImg(event, file) {
        AppGlobal.getInstance().flag = "showImg";
        //console.log("showImg:" + src);
        //this.photoViewer.show(src, '', { share: false });

        if (AppGlobal.getInstance().isCordova && AppGlobal.getInstance().isIos) {
            console.log("showImg:" + file.path);
            this.photoViewer.show(file.path, '', { share: false });
            AppGlobal.getInstance().flag = '';
        } else {
            let data: any = {};
            file.oUrl = file.path;
            file.localFile_o = file.path;
            data.body = {images: [file]};
            this.navCtrl.push(ImageSlidesPage, {moment: data, index: 0});
        }

    }

    delReferenceSelect(event, field) {
        if (this.orderForm.bindType === 'ServiceOrder') {
            if (field.name === 'agentUser') {
                this.orderInstance[field.name] = null;
                this.form.controls[field.name].setValue(this.orderInstance[field.name]);


                this.orderInstance.agentCompany = null;
                this.orderInstance.agentPhone = null;
                this.orderInstance.agentEmail = null;
                this.orderInstance.agentLabel = null;

                this.form.controls['agentCompany'].setValue(this.orderInstance.agentCompany);
                this.form.controls['agentPhone'].setValue(this.orderInstance.agentPhone);
                this.form.controls['agentEmail'].setValue(this.orderInstance.agentEmail);
                this.form.controls['agentLabel'].setValue(this.orderInstance.agentLabel);

            } else {
                this.orderInstance[field.name] = null;
                this.form.controls[field.name].setValue(null);
            }

        } else {
            this.orderInstance[field.name] = null;
            this.form.controls[field.name].setValue(null);
        }

    }

    delResource(field, resource){
        let value = this.orderInstance[field.name];
        if (resource && value) {
            for (let i = 0; i < value.length; i++) {
                if (resource.id === value[i].id && resource.classType === value[i].classType) {
                    value.splice(i, 1);
                }
            }
        }

        this.form.controls[field.name].setValue(this.orderInstance[field.name]);
    }
    
    resourceTypeSelect(field) {
        if (field.controlSetting) {
            let resourceCategoryData: any = AppGlobal.getInstance().resourceCategoryData;
            if (resourceCategoryData == null){
                this.serviceOrderData.getResourceType()
                .then(categoryData => {
                    AppGlobal.getInstance().resourceCategoryData = categoryData;
                    resourceCategoryData = categoryData;        
                    try {
                            let alert = this.alertCtrl.create();
                            alert.setTitle('选择对象');
                            //cgh
                            resourceCategoryData.children.checkedOne=true;
                            let h="";
                            this.buildTree(alert,resourceCategoryData.children,h);
        
                            alert.addButton('取消');
                            alert.addButton({
                                text: '确定',
                                handler: (data: any) => {                           
                                    console.log('Radio data:', data);
                                        let profileModal = this.modalCtrl.create(OrderResourceSelectPage, {
                                            field: field,
                                            type: data,
                                            orderInstance: this.orderInstance,
                                            order: this.order
                                        }, {
                                                showBackdrop: false,
                                                enterAnimation: 'modal-slide-in',
                                                leaveAnimation: 'modal-slide-out'
                                            });
            
                                        profileModal.present();
            
                                        profileModal.onDidDismiss((data: any) => {
                                            if (data) {
            
                                                let value = this.orderInstance[field.name];
                                                if (value) {
            
                                                    this.orderInstance[field.name] = value.concat(data);
                                                } else {
                                                    this.orderInstance[field.name] = data;
                                                }
                                                this.form.controls[field.name].setValue(this.orderInstance[field.name]);
                                            }
                                        });
                                }
                            });
                            alert.present();
                    } catch (error) {
                        let alert = this.alertCtrl.create({
                            title: '发生错误',
                            buttons: ['确认']
                        });
                        alert.present();
                        return;
                    }
                }).catch(error => {
                    console.error('error', error);
                });
            } else {  
                try {                          
                        let alert = this.alertCtrl.create();
                        alert.setTitle('选择对象');
                        let h="";
                        //cgh  
                        resourceCategoryData.children.checkedOne=true;
                        this.buildTree(alert,resourceCategoryData.children,h);
                        
                        alert.addButton('取消');
                        alert.addButton({
                            text: '确定',
                            handler: (data: any) => {
                                console.log('Radio data:', data);

                                    let profileModal = this.modalCtrl.create(OrderResourceSelectPage, {
                                        field: field,
                                        type: data,
                                        orderInstance: this.orderInstance,
                                        order: this.order
                                    }, {
                                            showBackdrop: false,
                                            enterAnimation: 'modal-slide-in',
                                            leaveAnimation: 'modal-slide-out'
                                        });
        
                                    profileModal.present();
        
                                    profileModal.onDidDismiss((data: any) => {
                                        if (data) {
        
                                            let value = this.orderInstance[field.name];
                                            if (value) {
        
                                                this.orderInstance[field.name] = value.concat(data);
                                            } else {
                                                this.orderInstance[field.name] = data;
                                            }
                                            this.form.controls[field.name].setValue(this.orderInstance[field.name]);
                                        }
                                    });
                            }
                        });
                        alert.present();
                } catch (error) {
                    let alert = this.alertCtrl.create({
                        title: '发生错误',
                        buttons: ['确认']
                    });
                    alert.present();
                    return;
                }
            }
        }
    }


    buildTree(alert,categoryDataChild,h){
        for (let i = 0; i < categoryDataChild.length; i++) {
            if (categoryDataChild[i].genre == 1 || categoryDataChild[i].genre == 3){
                // cgh
                if( categoryDataChild.checkedOne ){
                    alert.addInput({
                        type: 'radio',
                        label: h + categoryDataChild[i].label,
                        value: categoryDataChild[i],
                        checked: "checked"
                    });
                }else{
                    alert.addInput({
                        type: 'radio',
                        label: h + categoryDataChild[i].label,
                        value: categoryDataChild[i],
                        checked: false                      
                    });
                }
                categoryDataChild.checkedOne=false;
            }
            if (categoryDataChild[i].children != null && categoryDataChild[i].children.length > 0){
                let h1=h + "--";
                this.buildTree(alert,categoryDataChild[i].children,h1);
            }
        }
    }

    isCoordinationRequest = function () {
        if (this.coordinationRequests && this.coordinationRequests.length > 0) {
            return true;
        } else {
            return false;
        }
    };

    getFileName(file){
        file = file||"";
        let s:String = new String(file);
        let type = "inf";
        if(s.lastIndexOf("\.")+1<s.length){
            type = s.substring(s.lastIndexOf("\.")+1).toLocaleLowerCase();
        }
        return  `assets/fileIcon/${type}.png`
    } 



    //textarea高度自适应
  textAreaAutoHeight(dom){
    let scrollHeight = 0;
    let inputDom = dom['_elementRef'].nativeElement.firstElementChild
    this.renderer.setElementStyle(inputDom,'height','20px'); 
    scrollHeight = inputDom.scrollHeight ;
    if(scrollHeight >= 160){
        scrollHeight = 160 
        this.renderer.setElementStyle(inputDom,'overflowY','auto')
    }else{
        this.renderer.setElementStyle(inputDom,'overflowY','hidden')
    }
    this.renderer.setElementStyle(inputDom,'height',scrollHeight + 'px');
    this.renderer.setElementStyle(inputDom.parentNode,'height',20 + scrollHeight + 'px')
  }
  //数组排序
  sortAddress(datas,nickName) {
    let addressMap = {
      A:[],
      B:[],
      C:[],
      D:[],
      E:[],
      F:[],
      G:[],
      H:[],
      I:[],
      J:[],
      K:[],
      L:[],
      M:[],
      N:[],
      O:[],
      P:[],
      Q:[],
      R:[],
      S:[],
      T:[],
      U:[],
      V:[],
      W:[],
      X:[],
      Y:[],
      Z:[],
      "#":[]
    };
    datas.forEach((d:any) => {
        var tempInfo = pinyin.getFullChars(d[nickName].trim());
        // console.log(tempInfo)
        d.py = tempInfo;
        if(addressMap[tempInfo[0].toUpperCase()]){
          addressMap[tempInfo[0].toUpperCase()].push(d);
        }else{
          addressMap['#'].push(d);
        }
    });
    Object.keys(addressMap).forEach(function(element){
      addressMap[element].sort(function(a,b){
        return naturalComparator(a.py,b.py);
      })
    });
    return this.concatAddress(addressMap);
  }
    //对象转数组
    concatAddress(addressMap) {
        let tempAddressList = [];
        Object.keys(addressMap).forEach(function(element){
            if(addressMap[element].length > 0){
            tempAddressList = tempAddressList.concat(addressMap[element]);
            }
        });
        return tempAddressList;
    }
    isMyFlile(fileData,accountName){
    if(fileData.data && fileData.data.dir){
        fileData.isMy = fileData.data.dir.indexOf(accountName)!=-1?true:false;//itsnow. itsnow.cgh1. true
        if(fileData.isMy){//itsnow. itsnow.xxxx itsnow.cgh1. itsnow.cgh1.xxx
            fileData.isMy = fileData.data.dir.split(".").length == accountName.split(".").length?true:false;
        }
    }
    console.log(accountName+"--"+fileData.data.name+"--"+"是我上传得照片？"+fileData.isMy);
    }    
    bulidCommentField(firstChild) {
        firstChild.filedatas = [];
        if(firstChild.readonly || this.hideRun){
            if(this.comment&&this.comment[firstChild.name]&&this.comment[firstChild.name].length>0){
                firstChild.hidden = false;
            }else{
                firstChild.hidden = true;
            }
        }else{
            firstChild.hidden = false;
            firstChild.uploadShow = true;
            firstChild.upload = true;
        }
        if (this.comment&&this.comment[firstChild.name]&&this.comment[firstChild.name].length>0) {
            try {
                let accountName = this.webUser.account.replace(":",".")+".";
                this.comment.attachment.forEach(data => {
                    let filePath;
                    let fileName;
                    let sourceData = AppGlobal.getInstance().OPERATION_URL + '/operation/';
                    sourceData = sourceData + data.url;
                    //fileName = data.dir + data.name
                    fileName = data.dir + data.name.substring(data.name.lastIndexOf('.'), data.name.length);
    
                    let fileData: any = { name: data.name, contentType: data.contentType, data: data };
    
                    let location: any = new String(data.name);
                    let point = location.lastIndexOf(".") + 1;
    
                    let contentType = location.substring(point).toLocaleLowerCase();
    
                    fileData.contentType = contentType;
                    if (contentType === 'jpg' || contentType === 'jpeg' || contentType === 'gif' || contentType === 'png' || contentType === 'bmp') {
                        fileData.type = 'image';
                    } else {
                        fileData.type = 'file';
                    }
                    this.isMyFlile(fileData,accountName);
                    if (this.isWeb) {
                        fileData.path = sourceData;
                        fileData.ios = AppGlobal.getInstance().isIos;
                        fileData.isWeb = this.isWeb;
                        firstChild.filedatas.push(fileData);
                    } else {
                        if (AppGlobal.getInstance().isIos) {
                            filePath = cordova.file.documentsDirectory + AppGlobal.getInstance().LOCAL_FILE_NAME + "/";
                        } else {
                            filePath = cordova.file.externalApplicationStorageDirectory + AppGlobal.getInstance().LOCAL_FILE_NAME + "/";
                        }
                        if (fileData.type === 'image') {
                            this.getImagePath(sourceData, filePath, fileName).then(
                                (sizerFilePath: string) => {
                                    fileData.path = filePath + fileName;
                                    fileData.ios = AppGlobal.getInstance().isIos;
                                    fileData.isWeb = this.isWeb;
                                    fileData.isShow = true;
    
                                    console.log("fileImgUrl:" + fileData.path);
                                    firstChild.filedatas.push(fileData);
                                }, () => { console.log('Error occured'); }
                            );
                        } else {
                            this.file.checkFile(filePath, fileName).then(isExist => {
                                fileData.path = filePath + fileName;
                                fileData.ios = AppGlobal.getInstance().isIos;
                                fileData.isWeb = this.isWeb;
                            }).catch(err => {
                                const fileTransfer = this.transfer.create();				
                                fileTransfer.download(encodeURI(sourceData), filePath + fileName).then((entry) => {
                                    fileData.path = filePath + fileName;
                                    fileData.ios = AppGlobal.getInstance().isIos;
                                    fileData.isWeb = this.isWeb;
                                }, (error) => {
                                    //handle error
                                    console.log("fileDownloadErr:" + error);
                                });
                            });                         
                            firstChild.filedatas.push(fileData);
                        }
                    }
                    console.log("sendOrderFile:" + JSON.stringify(fileData));          
                });
            } catch (error) {
                console.log('comment error:', error);
            }
        }
    }
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

}
