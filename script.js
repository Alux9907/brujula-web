// Variables globales
let currentHeading = 0;
let isCalibrating = false;
let calibrationOffset = 0;
let sensorActive = false;
let retryCount = 0;
const maxRetries = 5;

// Elementos del DOM
const needle = document.getElementById('needle');
const headingDisplay = document.getElementById('heading');
const statusDisplay = document.getElementById('status');
const calibrateBtn = document.getElementById('calibrate-btn');

// ============================================
// FUNCIÓN PRINCIPAL: Manejar la orientación
// ============================================
function handleOrientation(event) {
    let heading = null;
    
    console.log('📊 Evento recibido:', {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        webkitCompassHeading: event.webkitCompassHeading,
        absolute: event.absolute
    });
    
    // DETECTAR iOS (Safari)
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        heading = event.webkitCompassHeading;
        sensorActive = true;
        console.log('✅ iOS - heading:', heading);
        
        if (event.webkitCompassAccuracy !== undefined) {
            const accuracy = event.webkitCompassAccuracy;
            if (accuracy < 0) {
                statusDisplay.textContent = '⚠️ Sensor no disponible';
                return;
            } else if (accuracy > 20) {
                statusDisplay.textContent = '🔄 Calibrando... mueve el teléfono en forma de 8';
            } else {
                statusDisplay.textContent = '✅ Brújula lista';
            }
        }
    }
    // DETECTAR Android y otros
    else if (event.alpha !== undefined && event.alpha !== null && event.alpha !== 0) {
        heading = event.alpha;
        sensorActive = true;
        console.log('✅ Android - alpha:', heading);
        
        if (event.absolute === true) {
            statusDisplay.textContent = '✅ Brújula lista (absoluta)';
        } else {
            statusDisplay.textContent = '✅ Brújula lista';
        }
    }
    // Si alpha es 0, podría ser que el sensor no esté calibrado
    else if (event.alpha === 0) {
        console.log('⚠️ Alpha es 0 - sensor no calibrado');
        statusDisplay.textContent = '🔄 Calibrando... mueve el teléfono en forma de 8';
        return;
    }
    // Si no se pudo obtener el rumbo
    else {
        console.warn('⚠️ No se pudo obtener heading:', event);
        statusDisplay.textContent = '⏳ Esperando datos del sensor...';
        return;
    }
    
    // Aplicar calibración manual
    heading = (heading + calibrationOffset) % 360;
    if (heading < 0) heading += 360;
    
    // Guardar el valor actual
    currentHeading = heading;
    
    // Actualizar la aguja
    needle.style.transform = `translate(-50%, -100%) rotate(${-heading}deg)`;
    
    // Actualizar el display del rumbo
    headingDisplay.textContent = Math.round(heading);
}

// ============================================
// FUNCIÓN PARA ACTIVAR SENSORES CON TOQUE
// ============================================
function activateSensorsWithTouch() {
    console.log('👆 Activando sensores por toque...');
    statusDisplay.textContent = '🔄 Activando sensores...';
    
    // Crear un evento dummy para "despertar" los sensores
    if (window.DeviceOrientationEvent) {
        // En Android, a veces los sensores se activan con un evento de toque
        window.removeEventListener('deviceorientation', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation, true);
        
        // Intentar con un evento de movimiento también
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', function motionHandler(e) {
                console.log('📱 Devicemotion activado:', e.acceleration);
                // Si recibimos datos de movimiento, los sensores están activos
                if (e.acceleration && (e.acceleration.x !== null || e.acceleration.y !== null)) {
                    statusDisplay.textContent = '✅ Sensores activos! Esperando orientación...';
                    window.removeEventListener('devicemotion', motionHandler);
                }
            }, true);
        }
        
        // Forzar una lectura solicitando permiso de nuevo (solo iOS)
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    console.log('Permiso:', state);
                    if (state === 'granted') {
                        statusDisplay.textContent = '✅ Permiso concedido, esperando datos...';
                    }
                })
                .catch(err => console.error('Error en permiso:', err));
        }
        
        // Si después de 5 segundos no hay datos, intentar reconectar
        setTimeout(() => {
            if (!sensorActive && retryCount < maxRetries) {
                retryCount++;
                console.log(`🔄 Reintento ${retryCount}/${maxRetries}`);
                statusDisplay.textContent = `🔄 Reintentando (${retryCount}/${maxRetries})...`;
                
                // Reiniciar el listener
                window.removeEventListener('deviceorientation', handleOrientation);
                window.addEventListener('deviceorientation', handleOrientation, true);
            } else if (!sensorActive && retryCount >= maxRetries) {
                statusDisplay.textContent = '⚠️ Activa los sensores: mueve el teléfono en forma de 8';
                // Mostrar un mensaje de ayuda
                showHelpMessage();
            }
        }, 5000);
    }
}

// ============================================
// MOSTRAR MENSAJE DE AYUDA
// ============================================
function showHelpMessage() {
    const helpDiv = document.createElement('div');
    helpDiv.style.cssText = `
        background: rgba(255, 200, 0, 0.1);
        border: 1px solid #f0c040;
        border-radius: 10px;
        padding: 15px;
        margin-top: 15px;
        font-size: 0.9rem;
        color: #f0c040;
    `;
    helpDiv.innerHTML = `
        <p><strong>📱 ¿No funciona?</strong></p>
        <ul style="text-align:left; padding-left:20px; margin:10px 0;">
            <li>🔒 Asegúrate de estar en <strong>HTTPS</strong></li>
            <li>🔄 Mueve el teléfono en <strong>forma de 8</strong></li>
            <li>📱 En Android: abre <strong>Chrome</strong> (no otras apps)</li>
            <li>⚙️ En Android: ve a <strong>Ajustes > Apps > Chrome > Permisos</strong> y activa <strong>sensores</strong></li>
            <li>🍎 En iOS: ve a <strong>Ajustes > Safari > Privacidad</strong> y activa <strong>Acceso a movimiento</strong></li>
        </ul>
    `;
    document.querySelector('.info').after(helpDiv);
}

// ============================================
// SOLICITAR PERMISO (para iOS y Android)
// ============================================
async function requestPermission() {
    try {
        // Verificar si el navegador soporta DeviceOrientationEvent
        if (typeof DeviceOrientationEvent === 'undefined') {
            statusDisplay.textContent = '❌ Tu navegador no soporta DeviceOrientation';
            return false;
        }
        
        // iOS 13+ requiere permiso explícito
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            statusDisplay.textContent = '🔐 Solicitando permiso...';
            const permissionState = await DeviceOrientationEvent.requestPermission();
            console.log('Permiso iOS:', permissionState);
            
            if (permissionState === 'granted') {
                statusDisplay.textContent = '✅ Permiso concedido';
                window.addEventListener('deviceorientation', handleOrientation, true);
                
                // Verificar si llegan datos
                setTimeout(() => {
                    if (!sensorActive) {
                        statusDisplay.textContent = '⏳ Mueve el teléfono para activar el sensor';
                        // Intentar activar con un toque virtual
                        activateSensorsWithTouch();
                    }
                }, 2000);
                
                return true;
            } else {
                statusDisplay.textContent = '❌ Permiso denegado por el usuario';
                return false;
            }
        } else {
            // Android: añadir listener
            statusDisplay.textContent = '✅ Conectando al sensor...';
            window.addEventListener('deviceorientation', handleOrientation, true);
            
            // En Android, a veces es necesario un evento de toque
            document.addEventListener('click', function firstClick() {
                console.log('👆 Click detectado, activando sensores...');
                document.removeEventListener('click', firstClick);
                activateSensorsWithTouch();
            }, { once: true });
            
            // También intentar activar automáticamente
            setTimeout(() => {
                if (!sensorActive) {
                    activateSensorsWithTouch();
                }
            }, 1000);
            
            return true;
        }
    } catch (error) {
        console.error('Error al solicitar permiso:', error);
        statusDisplay.textContent = '❌ Error: ' + error.message;
        return false;
    }
}

// ============================================
// CALIBRACIÓN MANUAL
// ============================================
function calibrateCompass() {
    if (isCalibrating) return;
    if (!sensorActive) {
        statusDisplay.textContent = '⚠️ Espera a que la brújula se active';
        activateSensorsWithTouch();
        return;
    }
    
    isCalibrating = true;
    calibrateBtn.textContent = '🔄 Calibrando...';
    
    let readings = [];
    const maxReadings = 10;
    let count = 0;
    
    const interval = setInterval(() => {
        if (currentHeading !== 0) {
            readings.push(currentHeading);
            count++;
            statusDisplay.textContent = `📊 Calibrando... ${count}/${maxReadings}`;
        }
        
        if (count >= maxReadings) {
            clearInterval(interval);
            
            const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
            
            let offset = 0;
            if (avg > 10 && avg < 350) {
                offset = -avg;
                while (offset < 0) offset += 360;
            }
            
            calibrationOffset = offset;
            isCalibrating = false;
            calibrateBtn.textContent = '🔄 Calibrar';
            statusDisplay.textContent = `✅ Calibrado (offset: ${Math.round(calibrationOffset)}°)`;
            
            const fakeEvent = { alpha: currentHeading, webkitCompassHeading: currentHeading };
            handleOrientation(fakeEvent);
        }
    }, 200);
}

// ============================================
// DETECTAR SI EL DISPOSITIVO TIENE SENSORES
// ============================================
function checkSensorSupport() {
    // Verificar si el navegador soporta DeviceOrientation
    if (typeof DeviceOrientationEvent === 'undefined') {
        statusDisplay.textContent = '❌ Tu navegador no soporta sensores de orientación';
        return false;
    }
    
    // Intentar detectar el sensor en Android
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'sensors' })
            .then(result => {
                console.log('Permiso de sensores:', result.state);
                if (result.state === 'denied') {
                    statusDisplay.textContent = '❌ Permiso de sensores denegado en el sistema';
                }
            })
            .catch(err => console.log('No se pudo verificar permisos:', err));
    }
    
    return true;
}

// ============================================
// INICIAR LA BRÚJULA
// ============================================
async function init() {
    statusDisplay.textContent = '🔄 Iniciando brújula...';
    
    // Verificar soporte
    if (!checkSensorSupport()) {
        return;
    }
    
    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const success = await requestPermission();
    
    if (!success) {
        statusDisplay.textContent = '❌ No se pudo iniciar la brújula';
    }
    
    // Si después de 8 segundos no hay datos, mostrar ayuda
    setTimeout(() => {
        if (!sensorActive) {
            statusDisplay.textContent = '⚠️ Mueve el teléfono en forma de 8 para calibrar';
            showHelpMessage();
        }
    }, 8000);
    
    console.log('🧭 Brújula Web iniciada');
    console.log('📱 Si no funciona, toca la pantalla o mueve el teléfono');
}

// ============================================
// EVENTOS DE LA INTERFAZ
// ============================================
calibrateBtn.addEventListener('click', calibrateCompass);

// Tocar la pantalla activa los sensores en Android
document.addEventListener('click', () => {
    console.log('👆 Pantalla tocada');
    if (!sensorActive) {
        activateSensorsWithTouch();
    }
});

document.addEventListener('touchstart', () => {
    console.log('👆 Touch detectado');
    if (!sensorActive) {
        activateSensorsWithTouch();
    }
}, { passive: true });

// ============================================
// INICIAR TODO
// ============================================
init();

// Manejar errores
window.addEventListener('error', (e) => {
    console.error('Error:', e);
    statusDisplay.textContent = '❌ Error: ' + e.message;
});