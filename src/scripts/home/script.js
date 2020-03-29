// Materialize inites
$(".menu-register").dropdown({
    belowOrigin: true
});

// Funções do front

var model_path = 'src/ml/';

setTimeout(()=> {

    $(async function() {

        let isSetting = localStorage.getItem('cnpj');
        
        // Carrega os modelos
        await faceapi.loadTinyFaceDetectorModel(model_path);
        await faceapi.loadFaceLandmarkModel(model_path);
        await faceapi.loadFaceRecognitionModel(model_path);
    
        if (isSetting == undefined || isSetting == null) {
            $('.body-login').show('fast');
            sendSync();
            timePeriodSync();
        }else {
            loadOfflineData();
            $('.body-splash').slideUp('fast', function() {
                $('.body').fadeIn('fast');
                $('.brand-logo').text(localStorage.getItem('org'));
                showHour();
                picoTracking();
                defaultCam();
                timePeriodSync();
            });
        }
    });
},1500);

function picoTracking() {

    let update_memory = pico.instantiate_detection_memory(5);

    let facefinder_classify_region = function(r, c, s, pixels, ldim) {return -1.0;};
    
    let cascadeurl = 'src/scripts/libs/cascate/facefinder';
    
    fetch(cascadeurl).then(function(response) {
        response.arrayBuffer().then(function(buffer) {
            let bytes = new Int8Array(buffer);
            facefinder_classify_region = pico.unpack_cascade(bytes);
        });
    })

    let ctx = document.getElementById('tracking-canvas').getContext('2d');

    function rgba_to_grayscale(rgba, nrows, ncols) {
        let gray = new Uint8Array(nrows*ncols);
        for(let r=0; r<nrows; ++r)
            for(let c=0; c<ncols; ++c)

            gray[r*ncols + c] = (2*rgba[r*4*ncols+4*c+0]+7*rgba[r*4*ncols+4*c+1]+1*rgba[r*4*ncols+4*c+2])/10;
        return gray;
    }

    let processfn = function(video, dt) {

        ctx.drawImage(video, 0, 0);
        let rgba = ctx.getImageData(0, 0, 640, 480).data;

        image = {
            "pixels": rgba_to_grayscale(rgba, 480, 640),
            "nrows": 480,
            "ncols": 640,
            "ldim": 640
        }
        params = {
            "shiftfactor": 0.1,
            "minsize": 100,
            "maxsize": 1000,
            "scalefactor": 1.1
        }

        dets = pico.run_cascade(image, facefinder_classify_region, params);
        dets = update_memory(dets);
        dets = pico.cluster_detections(dets, 0.2);

        if (dets.length > 0) { // Se identificar o rosto
            if (dets[0][3] > 50.0) { // Verifica a confiança de que é um rosto
                distanceAnalize(dets[0][2]);
            }
        }
    }

    let mycamvas = new camvas(ctx, processfn);
}

var Cam = Webcam;
var checkcam = false;

function defaultCam() {

    let width = 640;
    let heigth = 480;

    Cam.set({
        width: width,
        height: heigth
    });

    Cam.attach('#check-person');

    initeCams();
}

function distanceAnalize(params) {

    if (params > 150) { // Distancia padrão 150
        checkcam = true;
    }else {
        checkcam = false;
    }
}

var verifyOfficials = null;

function analisePoint() {

    verifyOfficials = setInterval(() => {
        if (checkcam) {
            recognitionCheck();
        }else {
            $('#instructions').text('Aproxime-se');
        }
    }, 1000);
}

function stableCamCheck() {
    setInterval(()=> {
        if (checkcam) {
            checkcam = false;
        }
    }, 1500);
}stableCamCheck();

async function recognitionCheck() {

    clearInterval(verifyOfficials);

    let offlineData = localStorage.getItem('offline_recognition');
    let offlineDataParse = JSON.parse(offlineData);

    if (offlineData == null) {
        Materialize.toast('Funcionários não registrado para estação de ponto', 4000);
        return
    }else if(offlineDataParse.length == 0) {
        Materialize.toast('Funcionários não ativos para estação de ponto', 4000);
        return
    }else {
        Cam.snap(function(data_uri) {
            $('#show-person').attr('src', data_uri);
        });
    }

    $('#instructions').text('');

    let element = $('#show-person');

    let analise = await faceapi.detectSingleFace(element[0], new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

    let storeDistance = [];
    let storeName = [];
    let matchNote = null;

    await $.each(officalsMatch, function(i, val) { // Analiza a imagem da camera
        
        if (analise) {
            
            matchNote = officalsMatch[i].findBestMatch(analise.descriptor);

            if (matchNote.label !== 'unknown') {
                storeDistance.push(matchNote.distance);
                storeName.push(matchNote.label);
            }else {
                $('#show-name').text('Olhe para camera...');
            }
        }
    });

    // Mostra qual a melhor pontuação
    let minvalue = Array.min(storeDistance);

    $('#show-name').text(storeName[0]);
    $('#instructions').text('Um instante...');

    registerPoint();
}

async function registerPoint() {

    let uriPoint = 'https://fierce-intelligence.000webhostapp.com/point/';
    let uriPointImage = 'https://fierce-intelligence.000webhostapp.com/point/image/';

    let date = new Date();
    let hourNow = date.getHours();
    let minutesNow = date.getMinutes();
    let dayNow = date.getDate();
    let monthNow = date.getMonth();
    let yearNow = date.getFullYear().toString().substr(-2);

    let working = JSON.parse(localStorage.getItem('working'));
    let officials = JSON.parse(localStorage.getItem('officals'));
    let recognition = JSON.parse(localStorage.getItem('offline_recognition'));
    let points = JSON.parse(localStorage.getItem('points'));

    // Pessoas com imagens cadastradas
    let name = $('#show-name').text();
    let names = []

    $.each(officials.officials, function(i, val) {
        names.push(val.officials_name);
    });

    let registration = null;
    let nameUser = null;

    if ($.inArray(name, names) !== -1) {

        // Configuração dos dados

        $.each(officials.officials, function(i, val) {
            if (val.officials_name == name) {
                nameUser = name;
                registration = val.officials_registration;
            }
        });

        if (dayNow < 10) {
            dayNow = '0'+dayNow;
        }

        if (monthNow < 10) {
            monthNow = '0'+monthNow+1;
        }

        if (hourNow < 10) {
            hourNow = '0'+hourNow;
        }

        if (minutesNow < 10) {
            minutesNow = '0'+minutesNow;
        }

        let storePoints = points.points;

        // Verifica o recurso do navegador
        if (navigator.geolocation) {

            if (navigator.onLine) {
                
                navigator.geolocation.getCurrentPosition(function(position) {

                    let dataPoint = {
                        registration: registration,
                        day: dayNow,
                        month: monthNow+1,
                        year: yearNow,
                        hour: hourNow,
                        minute: minutesNow,
                        status: 'Presença',
                        referense: btoa(registration+dayNow+minutesNow).substr(-10)
                    }

                    dataPoint.geo_lat =  geo_lat = position.coords.latitude;
                    dataPoint.geo_long = geo_long = position.coords.longitude;

                    storePoints.push(dataPoint);
                    localStorage.setItem('points', JSON.stringify({points: storePoints}));

                    // Sincronização do ponto
                    $.post(uriPoint, {token: localStorage.getItem('public_token'), registration: dataPoint.registration, day: dataPoint.day, month: dataPoint.month, year: dataPoint.year, hour: dataPoint.hour, minute: dataPoint.minute, geo_lat: dataPoint.geo_lat, geo_long: dataPoint.geo_long, status: dataPoint.status, reference_code: dataPoint.referense}, function(data) {

                            let nameFile = nameUser.split(' ');
                            let newName = null;

                            $.each(nameFile, function(i, val) {
                                newName = newName+nameFile[i]+'-';
                            });

                            newName = newName.replace('null', '');
                            newName = newName.replace('--', '');
                            newName = newName.toLowerCase();
                            newName = removeAccent(newName);

                            let tt = $('#show-person').attr('src');
                            tt = tt.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

                            // Sincronização da imagem do ponto
                            $.post(uriPointImage, {registration: dataPoint.registration, sys_filename: newName, sys_dir: nameUser, point_reference_code: dataPoint.referense, file_type: 'base64', token: localStorage.getItem('public_token'), sys_file: tt}, function(data) {
                                Materialize.toast('Imagem sincronizada', 4000);
                            }).fail(function() {
                                Materialize.toast('Imagem não enviada', 4000);
                            });

                    }).done(function() {
                        Materialize.toast('Ponto sincronizado', 4000);
                    }).fail(function() {
                        Materialize.toast('Ponto registrado offline', 4000);
                    });

                    verifyPoints(localStorage.getItem('points'));

                });
            }else {

                let dataPoint = {
                    registration: registration,
                    day: dayNow,
                    month: monthNow+1,
                    year: yearNow,
                    hour: hourNow,
                    minute: minutesNow,
                    status: 'Presença',
                    referense: btoa(registration+dayNow+minutesNow).substr(-10)
                }
    
                dataPoint.geo_lat = geo_lat = 'sem conexão';
                dataPoint.geo_long = geo_long = 'sem conexão';
    
                storePoints.push(dataPoint);
                localStorage.setItem('points', JSON.stringify({points: storePoints}));

                verifyPoints(localStorage.getItem('points'));
            }
            
        }else {
            Materialize.toast('Não há suporte para geolocalização', 4000);
        }
    }else {
        $('#show-name').text('Por favor, tente novamente');
        $('#nao-bateu-ponto')[0].play();

        // Aviso sonoro e fila
        clearInterval(verifyOfficials);
        setTimeout(()=> {
            analisePoint();
        }, 2000);
    }
}

function verifyPoints(data) {



    // Aviso sonoro e fila
    $('#bateu-ponto')[0].play();
    clearInterval(verifyOfficials);
    setTimeout(()=> {
        analisePoint();
    }, 2000);
}

function removeAccent(text) {
    text = text.toLowerCase();                                                         
    text = text.replace(new RegExp('[ÁÀÂÃ]','gi'), 'a');
    text = text.replace(new RegExp('[ÉÈÊ]','gi'), 'e');
    text = text.replace(new RegExp('[ÍÌÎ]','gi'), 'i');
    text = text.replace(new RegExp('[ÓÒÔÕ]','gi'), 'o');
    text = text.replace(new RegExp('[ÚÙÛ]','gi'), 'u');
    text = text.replace(new RegExp('[Ç]','gi'), 'c');
    return text; 
}

Array.min = function(array) {
    return Math.min.apply(Math, array);
};

function initeCams() {

    let width = "100%";
    let heigth = "100%";
    Webcam.set({
        width: width,
        height: heigth
    });
    Webcam.attach('#body-video');
};

function showHour() {

    let months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

    let date = new Date();
    let hour = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();
    let month = months[date.getMonth()];
    let dayName = days[date.getDay()];
    let dateDay = date.getDate();

    if (minutes < 10) {
        minutes = '0'+minutes;
    }

    if (hour < 10) {
        hour = '0'+hour;
    }

    $('#show-hour').text(hour+':'+minutes+':'+seconds);
    $('#show-day').text(dayName+', '+dateDay+' de '+month);
    setTimeout(() => {
        showHour();
    }, 1000);
};

var token = null;

var userList = 'https://fierce-intelligence.000webhostapp.com/user/list/all/';
var userImagesList = 'https://fierce-intelligence.000webhostapp.com/user/images/list/';
var workingList = 'https://fierce-intelligence.000webhostapp.com/working/list/';
var orgAuth = 'https://fierce-intelligence.000webhostapp.com/org/auth/';

function sendSync() {
    $('#login-para-sincronizar').submit(function(e) {
        e.preventDefault();

        let cnpj = $('#cnpj').val();
        let senha = $('#senha').val();

        $.post(orgAuth, {cnpj: cnpj, pass: senha}, function(data) {
            if (Array.isArray(data.data_login_org)) {

                if (data.data_login_org[0].status == 'inactive') {
                    Materialize.toast('Empresa não operante', 4000);
                }else {

                    console.log('sinconizando por primeiro login...');

                    // Grava informações iniciais
                    localStorage.setItem('public_token', data.data_login_org[0].token);
                    localStorage.setItem('cnpj', data.data_login_org[0].cnpj);
                    localStorage.setItem('org', data.data_login_org[0].org);
                    localStorage.setItem('points', JSON.stringify({points: []}));
                    localStorage.setItem('points_images', JSON.stringify({points_images: []}));
                    localStorage.setItem('points_data_org', JSON.stringify({acess: btoa(cnpj), auth: btoa(senha)}));

                    // Configura o token de acesso
                    token = localStorage.getItem('public_token');

                    // sincroniza as jornadas de trabalho
                    workingSync(workingList);

                    $('.body-splash').slideUp('fast', function() {
                        $('.body').fadeIn('fast');
                        $('.brand-logo').text(localStorage.getItem('org'));
                        showHour();
                        picoTracking();
                        defaultCam();
                        timePeriodSync();
                    });
                }

            }else {
                Materialize.toast('Não autenticado', 4000);
            }
        }).fail(function() {
            Materialize.toast('Ocorreu um erro', 4000);
        });

    });
}

async function syncPeriod() {

    let dataOrg = localStorage.getItem('points_data_org');
    dataOrg = JSON.parse(dataOrg);

    let isConnection = navigator.onLine;

    console.log('navegador online: ', isConnection);

    if (dataOrg !== null && isConnection) {

        await window.localStorage.clear();

        $.post(orgAuth, {cnpj: atob(dataOrg.acess), pass: atob(dataOrg.auth)}, function(data) {
            if (Array.isArray(data.data_login_org)) {

                if (data.data_login_org[0].status == 'inactive') {
                    Materialize.toast('Empresa não operante', 4000);
                }else {

                    // Reseta os descriptors
                    localStorage.setItem('offline_recognition', '[]');

                    console.log('sinconizando por periodo...');

                    // Grava informações iniciais
                    localStorage.setItem('public_token', data.data_login_org[0].token);
                    localStorage.setItem('cnpj', data.data_login_org[0].cnpj);
                    localStorage.setItem('org', data.data_login_org[0].org);
                    localStorage.setItem('points', JSON.stringify({points: []}));
                    localStorage.setItem('points_images', JSON.stringify({points_images: []}));
                    localStorage.setItem('points_data_org', JSON.stringify({acess: dataOrg.acess, auth: dataOrg.auth}));
    
                    // Configura o token de acesso
                    token = localStorage.getItem('public_token');
    
                    // sincroniza as jornadas de trabalho
                    workingSync(workingList);
                }
    
            }else {
                Materialize.toast('Não foi possível a autenticação', 4000);
                localStorage.clear();
            }
        });
    }
}

var isSync1 = false;
var isSync2 = false;

function timePeriodSync() {

    let date = new Date();
    let hourNow = date.getHours();
    let hourSync1 = 12; // 12:00 h
    let hourSync2 = 18; // 18:00 h

    setInterval(()=> {
        
        if (hourSync1 == hourNow && isSync1 == false) {
            isSync1 = true;
            isSync2 = false;
            syncPeriod();
        }

        if (hourSync2 == hourNow && isSync2 == false) {
            isSync2 = true;
            isSync1 = false;
            syncPeriod();
        }
    }, 1000);
}

function workingSync(uri) {

    $.post(uri, {token: token, cnpj: localStorage.getItem('cnpj')}, function(data) {

        if (Array.isArray(data.working_data)) {

            console.log('sinconizando jornada(s)...');

            let working = {working: []};
            
            $.each(data.working_data, function(i, val) {
                
                if (val.sys_working_status == 'active') {
                    working.working.push(val);
                }
            });

            localStorage.setItem('working', JSON.stringify(working));
            userSync(userList);
        }else {
            Materialize.toast('Não existe Jornadas', 4000);
        }
    });
}

var offlineContents = [];

function userSync(uri) {

    $.post(uri, {token: token, cnpj: localStorage.getItem('cnpj')}, function(data) {

        console.log('sinconizando funcionários...');
        
        if (Array.isArray(data.all_user_data)) {

            $.each(data.all_user_data, function(i, valUser) { // Nome do funcionário 

                $.post(userImagesList, {token: token, registration: valUser.officials_registration}, function(data) {

                    if (Array.isArray(data.data_user_images)) {

                        console.log('sinconizando rede neural...');

                        $.each(data.data_user_images, function(i, valImg) { // Imagens do funcionario

                            if (valImg.sys_img_status == 'active') {

                                let descriptors = [valImg.sys_img_descriptor];

                                // Grava os descritores localmente
                                localStorage.setItem(valUser.officials_registration+'_descriptor-'+i, descriptors);

                                // Armazena os indices
                                offlineContents.push({name: valUser.officials_name, index:valUser.officials_registration+'_descriptor-'+i});
                            }
                            
                        });

                        localStorage.setItem('offline_recognition', JSON.stringify(offlineContents));

                        loadOfflineData();
                    }
                });
            });
            
            let officials = {officials: []};

            $.each(data.all_user_data, function(i, val) {
                
                if (val.officials_status == 'active') { // verifica se o usuario é ativo
                    officials.officials.push(val);
                }
            });

            localStorage.setItem('officals', JSON.stringify(officials));
        }else {
            Materialize.toast('Não existe Funcionários', 4000);
        }
    });
}

var officalsMatch = [];
var distance = 0.45; // 0.6 recomendado

async function loadOfflineData() {
    
    let loads = localStorage.getItem('offline_recognition');
    loads = JSON.parse(loads);

    await $.each(loads, function(i, valIndex) {

        // Transforma em array a string
        let toStore = localStorage.getItem(valIndex.index);
        toStore = toStore.split(',');

        // Cria um float32 do array
        let full_descriptors = new Float32Array(toStore);

        // Rotula com os nomes
        let labels =  new faceapi.LabeledFaceDescriptors(valIndex.name, [full_descriptors]);

        // Agrupa os funcionários
        officalsMatch[i] = new faceapi.FaceMatcher(labels, distance);
    });

    // Inicializa a função para tracking e ponto
    clearInterval(verifyOfficials);
    analisePoint();
}

