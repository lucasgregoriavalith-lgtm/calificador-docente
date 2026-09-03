(function(){
  'use strict';

  var STORAGE_KEY = 'calificador_docente_v1';

  /* ---------- Capa de datos ---------- */
  function loadData(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { courses: [] };
      var parsed = JSON.parse(raw);
      if(!parsed || !Array.isArray(parsed.courses)) return { courses: [] };
      return parsed;
    }catch(e){
      console.error('Error leyendo datos guardados', e);
      return { courses: [] };
    }
  }

  function saveData(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function uid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ---------- Estado de la app ---------- */
  var state = {
    data: loadData(),
    view: 'courses', // 'courses' | 'subjects' | 'grades'
    courseId: null,
    subjectId: null
  };

  function getCourse(id){
    return state.data.courses.find(function(c){ return c.id === id; });
  }
  function getSubject(course, id){
    return course.subjects.find(function(s){ return s.id === id; });
  }

  /* ---------- Referencias al DOM ---------- */
  var elHeaderTitle = document.getElementById('header-title');
  var elBreadcrumb = document.getElementById('breadcrumb');
  var elMain = document.getElementById('app-main');
  var elBtnBack = document.getElementById('btn-back');
  var elBtnAdd = document.getElementById('btn-add');
  var elModalOverlay = document.getElementById('modal-overlay');
  var elModalBox = document.getElementById('modal-box');
  var elToast = document.getElementById('toast');
  var elImportInput = document.getElementById('import-file-input');

  /* ---------- Utilidades ---------- */
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(s){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[s];
    });
  }

  var toastTimer = null;
  function showToast(msg){
    elToast.textContent = msg;
    elToast.hidden = false;
    requestAnimationFrame(function(){ elToast.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      elToast.classList.remove('show');
      setTimeout(function(){ elToast.hidden = true; }, 200);
    }, 1600);
  }

  /* ---------- Modal genérico ---------- */
  function openModal(html, onOpen){
    elModalBox.innerHTML = html;
    elModalOverlay.hidden = false;
    requestAnimationFrame(function(){ elModalOverlay.classList.add('show'); });
    if(onOpen) onOpen(elModalBox);
    var firstInput = elModalBox.querySelector('input');
    if(firstInput){
      setTimeout(function(){ firstInput.focus(); firstInput.select && firstInput.select(); }, 60);
    }
  }
  function closeModal(){
    elModalOverlay.classList.remove('show');
    setTimeout(function(){
      elModalOverlay.hidden = true;
      elModalBox.innerHTML = '';
    }, 160);
  }
  elModalOverlay.addEventListener('click', function(e){
    if(e.target === elModalOverlay) closeModal();
  });

  function promptForName(opts){
    openModal(
      '<h2>' + escapeHtml(opts.title) + '</h2>' +
      '<form id="modal-form">' +
        '<label class="field-label" for="modal-input">' + escapeHtml(opts.label) + '</label>' +
        '<input id="modal-input" type="text" maxlength="60" placeholder="' + escapeHtml(opts.placeholder || '') + '" value="' + escapeHtml(opts.value || '') + '" autocomplete="off" />' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-ghost" id="modal-cancel">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Guardar</button>' +
        '</div>' +
      '</form>',
      function(box){
        box.querySelector('#modal-cancel').addEventListener('click', closeModal);
        box.querySelector('#modal-form').addEventListener('submit', function(e){
          e.preventDefault();
          var val = box.querySelector('#modal-input').value.trim();
          if(!val) return;
          closeModal();
          opts.onSubmit(val);
        });
      }
    );
  }

  function confirmAction(opts){
    openModal(
      '<h2>' + escapeHtml(opts.title) + '</h2>' +
      '<p class="modal-message">' + opts.message + '</p>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="modal-cancel">Cancelar</button>' +
        '<button type="button" class="btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger') + '" id="modal-confirm">' + escapeHtml(opts.confirmText || 'Eliminar') + '</button>' +
      '</div>',
      function(box){
        box.querySelector('#modal-cancel').addEventListener('click', closeModal);
        box.querySelector('#modal-confirm').addEventListener('click', function(){
          closeModal();
          opts.onConfirm();
        });
      }
    );
  }

  function actionSheet(opts){
    var actions = opts.actions;
    openModal(
      '<h2>' + escapeHtml(opts.title) + '</h2>' +
      '<div class="action-sheet">' +
        actions.map(function(a, i){
          return '<button type="button" class="btn btn-sheet' + (a.danger ? ' danger' : '') + '" data-idx="' + i + '">' + escapeHtml(a.label) + '</button>';
        }).join('') +
        '<button type="button" class="btn btn-ghost" id="modal-cancel">Cancelar</button>' +
      '</div>',
      function(box){
        box.querySelector('#modal-cancel').addEventListener('click', closeModal);
        box.querySelectorAll('[data-idx]').forEach(function(btn){
          btn.addEventListener('click', function(){
            var idx = parseInt(btn.dataset.idx, 10);
            closeModal();
            actions[idx].onClick();
          });
        });
      }
    );
  }

  /* ---------- Navegación ---------- */
  function goToCourses(){
    state.view = 'courses'; state.courseId = null; state.subjectId = null;
    render();
  }
  function goToSubjects(courseId){
    state.view = 'subjects'; state.courseId = courseId; state.subjectId = null;
    render();
  }
  function goToGrades(courseId, subjectId){
    state.view = 'grades'; state.courseId = courseId; state.subjectId = subjectId;
    render();
  }

  elBtnBack.addEventListener('click', function(){
    if(state.view === 'grades') goToSubjects(state.courseId);
    else if(state.view === 'subjects') goToCourses();
  });

  elBtnAdd.addEventListener('click', function(){
    if(state.view === 'courses') handleAddCourse();
    else if(state.view === 'subjects') handleAddSubject();
    else if(state.view === 'grades') handleAddStudent();
  });

  /* ---------- Cursos ---------- */
  function handleAddCourse(){
    promptForName({
      title: 'Nuevo curso',
      label: 'Nombre del curso',
      placeholder: 'Ej: 1er año A',
      onSubmit: function(name){
        state.data.courses.push({ id: uid(), name: name, subjects: [] });
        saveData();
        render();
        showToast('Curso creado');
      }
    });
  }

  function handleCourseMenu(course){
    actionSheet({
      title: course.name,
      actions: [
        {
          label: 'Renombrar',
          onClick: function(){
            promptForName({
              title: 'Renombrar curso',
              label: 'Nombre del curso',
              value: course.name,
              onSubmit: function(name){
                course.name = name; saveData(); render();
              }
            });
          }
        },
        {
          label: 'Eliminar curso',
          danger: true,
          onClick: function(){
            confirmAction({
              title: 'Eliminar curso',
              message: '¿Eliminar "' + escapeHtml(course.name) + '" y todas sus materias, estudiantes y notas? Esta acción no se puede deshacer.',
              onConfirm: function(){
                state.data.courses = state.data.courses.filter(function(c){ return c.id !== course.id; });
                saveData(); render(); showToast('Curso eliminado');
              }
            });
          }
        }
      ]
    });
  }

  function renderCourses(){
    elHeaderTitle.textContent = 'Mis cursos';
    elBtnBack.hidden = true;
    elBreadcrumb.hidden = true;
    elBreadcrumb.innerHTML = '';

    var courses = state.data.courses;
    var listHtml = courses.length === 0
      ? emptyState('📚', 'No tenés cursos todavía', 'Tocá el botón "+" para crear tu primer curso.')
      : '<div class="card-list">' + courses.map(function(c){
          return '<div class="card" data-id="' + c.id + '">' +
            '<div class="card-body" data-action="open">' +
              '<div class="card-title">' + escapeHtml(c.name) + '</div>' +
              '<div class="card-sub">' + c.subjects.length + ' materia' + (c.subjects.length === 1 ? '' : 's') + '</div>' +
            '</div>' +
            '<button class="card-menu" data-action="menu" aria-label="Opciones">&#8942;</button>' +
          '</div>';
        }).join('') + '</div>';

    elMain.innerHTML = listHtml + backupSectionHtml();

    elMain.querySelectorAll('.card').forEach(function(cardEl){
      var course = getCourse(cardEl.dataset.id);
      cardEl.querySelector('[data-action="open"]').addEventListener('click', function(){ goToSubjects(course.id); });
      cardEl.querySelector('[data-action="menu"]').addEventListener('click', function(e){ e.stopPropagation(); handleCourseMenu(course); });
    });

    bindBackupSection();
  }

  /* ---------- Backup: exportar / importar ---------- */
  function backupSectionHtml(){
    return '<div class="backup-section">' +
      '<p class="backup-hint">Los datos se guardan solo en este celular. Hacé un backup para no perderlos.</p>' +
      '<button type="button" class="btn-outline" id="btn-export-data">Exportar datos (backup)</button>' +
      '<button type="button" class="btn-outline" id="btn-import-data">Importar datos</button>' +
    '</div>';
  }

  function bindBackupSection(){
    var btnExport = document.getElementById('btn-export-data');
    var btnImport = document.getElementById('btn-import-data');
    if(btnExport) btnExport.addEventListener('click', handleExportData);
    if(btnImport) btnImport.addEventListener('click', function(){ elImportInput.click(); });
  }

  function handleExportData(){
    var json = JSON.stringify(state.data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var stamp = new Date().toISOString().slice(0, 10);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'calificador-backup-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    showToast('Backup descargado');
  }

  elImportInput.addEventListener('change', function(){
    var file = elImportInput.files[0];
    elImportInput.value = '';
    if(!file) return;

    var reader = new FileReader();
    reader.onload = function(){
      var parsed;
      try{
        parsed = JSON.parse(reader.result);
      }catch(e){
        showToast('El archivo no es un backup válido');
        return;
      }
      if(!parsed || !Array.isArray(parsed.courses)){
        showToast('El archivo no es un backup válido');
        return;
      }
      confirmAction({
        title: 'Importar datos',
        message: 'Esto va a reemplazar <strong>todos</strong> los cursos, materias, estudiantes y notas actuales por los del archivo. ¿Continuar?',
        confirmText: 'Reemplazar',
        onConfirm: function(){
          state.data = parsed;
          saveData();
          goToCourses();
          showToast('Datos importados correctamente');
        }
      });
    };
    reader.onerror = function(){ showToast('No se pudo leer el archivo'); };
    reader.readAsText(file);
  });

  /* ---------- Materias ---------- */
  function handleAddSubject(){
    var course = getCourse(state.courseId);
    promptForName({
      title: 'Nueva materia',
      label: 'Nombre de la materia',
      placeholder: 'Ej: Matemática',
      onSubmit: function(name){
        course.subjects.push({ id: uid(), name: name, numColumns: 1, students: [] });
        saveData(); render(); showToast('Materia creada');
      }
    });
  }

  function handleSubjectMenu(course, subject){
    actionSheet({
      title: subject.name,
      actions: [
        {
          label: 'Renombrar',
          onClick: function(){
            promptForName({
              title: 'Renombrar materia',
              label: 'Nombre de la materia',
              value: subject.name,
              onSubmit: function(name){ subject.name = name; saveData(); render(); }
            });
          }
        },
        {
          label: 'Eliminar materia',
          danger: true,
          onClick: function(){
            confirmAction({
              title: 'Eliminar materia',
              message: '¿Eliminar "' + escapeHtml(subject.name) + '" con todos sus estudiantes y notas?',
              onConfirm: function(){
                course.subjects = course.subjects.filter(function(s){ return s.id !== subject.id; });
                saveData(); render(); showToast('Materia eliminada');
              }
            });
          }
        }
      ]
    });
  }

  function renderSubjects(){
    var course = getCourse(state.courseId);
    if(!course){ goToCourses(); return; }

    elHeaderTitle.textContent = course.name;
    elBtnBack.hidden = false;
    elBreadcrumb.hidden = true;
    elBreadcrumb.innerHTML = '';

    if(course.subjects.length === 0){
      elMain.innerHTML = emptyState('📖', 'No hay materias todavía', 'Tocá el botón "+" para agregar una materia.');
      return;
    }

    elMain.innerHTML = '<div class="card-list">' + course.subjects.map(function(s){
      return '<div class="card" data-id="' + s.id + '">' +
        '<div class="card-body" data-action="open">' +
          '<div class="card-title">' + escapeHtml(s.name) + '</div>' +
          '<div class="card-sub">' + s.students.length + ' estudiante' + (s.students.length === 1 ? '' : 's') + ' &middot; ' + s.numColumns + ' nota' + (s.numColumns === 1 ? '' : 's') + '</div>' +
        '</div>' +
        '<button class="card-menu" data-action="menu" aria-label="Opciones">&#8942;</button>' +
      '</div>';
    }).join('') + '</div>';

    elMain.querySelectorAll('.card').forEach(function(cardEl){
      var subject = getSubject(course, cardEl.dataset.id);
      cardEl.querySelector('[data-action="open"]').addEventListener('click', function(){ goToGrades(course.id, subject.id); });
      cardEl.querySelector('[data-action="menu"]').addEventListener('click', function(e){ e.stopPropagation(); handleSubjectMenu(course, subject); });
    });
  }

  /* ---------- Notas ---------- */
  function handleAddStudent(){
    var course = getCourse(state.courseId);
    var subject = getSubject(course, state.subjectId);
    promptForName({
      title: 'Nuevo estudiante',
      label: 'Nombre y apellido',
      placeholder: 'Ej: Juan Pérez',
      onSubmit: function(name){
        subject.students.push({ id: uid(), name: name, grades: [] });
        saveData(); render(); showToast('Estudiante agregado');
      }
    });
  }

  function handleStudentMenu(subject, student){
    actionSheet({
      title: student.name,
      actions: [
        {
          label: 'Renombrar',
          onClick: function(){
            promptForName({
              title: 'Renombrar estudiante',
              label: 'Nombre y apellido',
              value: student.name,
              onSubmit: function(name){ student.name = name; saveData(); render(); }
            });
          }
        },
        {
          label: 'Eliminar estudiante',
          danger: true,
          onClick: function(){
            confirmAction({
              title: 'Eliminar estudiante',
              message: '¿Eliminar a "' + escapeHtml(student.name) + '" y todas sus notas?',
              onConfirm: function(){
                subject.students = subject.students.filter(function(s){ return s.id !== student.id; });
                saveData(); render(); showToast('Estudiante eliminado');
              }
            });
          }
        }
      ]
    });
  }

  function average(grades){
    var valid = grades.filter(function(g){ return typeof g === 'number' && !isNaN(g); });
    if(valid.length === 0) return null;
    var sum = valid.reduce(function(a, b){ return a + b; }, 0);
    return sum / valid.length;
  }

  // Agrega columnas nuevas mientras la última columna activa esté completa para todos los estudiantes
  function recalcColumns(subject){
    if(subject.students.length === 0) return;
    var guard = 0;
    while(guard++ < 500){
      var lastIdx = subject.numColumns - 1;
      var allFilled = subject.students.every(function(st){
        return typeof st.grades[lastIdx] === 'number' && !isNaN(st.grades[lastIdx]);
      });
      if(allFilled){
        subject.numColumns += 1;
      }else{
        break;
      }
    }
  }

  function formatGrade(n){
    return (Math.round(n * 100) / 100).toString().replace('.', ',');
  }
  function gradeClass(avg){
    if(avg < 4) return 'grade-low';
    if(avg < 7) return 'grade-mid';
    return 'grade-high';
  }

  function handleGradeCell(subject, student, colIndex){
    var current = typeof student.grades[colIndex] === 'number' ? student.grades[colIndex] : '';
    var hasValue = current !== '';
    openModal(
      '<h2>' + escapeHtml(student.name) + '</h2>' +
      '<p class="modal-message">Nota ' + (colIndex + 1) + ' (0 a 10)</p>' +
      '<form id="modal-form">' +
        '<input id="modal-input" type="number" inputmode="decimal" step="0.01" min="0" max="10" placeholder="0 - 10" value="' + current + '" />' +
        '<div class="modal-actions">' +
          (hasValue ? '<button type="button" class="btn btn-ghost" id="modal-clear">Borrar</button>' : '') +
          '<button type="button" class="btn btn-ghost" id="modal-cancel">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Guardar</button>' +
        '</div>' +
      '</form>',
      function(box){
        box.querySelector('#modal-cancel').addEventListener('click', closeModal);
        var clearBtn = box.querySelector('#modal-clear');
        if(clearBtn){
          clearBtn.addEventListener('click', function(){
            student.grades[colIndex] = null;
            recalcColumns(subject);
            saveData(); closeModal(); render();
          });
        }
        box.querySelector('#modal-form').addEventListener('submit', function(e){
          e.preventDefault();
          var raw = box.querySelector('#modal-input').value.trim().replace(',', '.');
          if(raw === ''){ closeModal(); return; }
          var val = parseFloat(raw);
          if(isNaN(val)){ closeModal(); return; }
          val = Math.max(0, Math.min(10, val));
          student.grades[colIndex] = val;
          recalcColumns(subject);
          saveData();
          closeModal();
          render();
        });
      }
    );
  }

  function renderGrades(){
    var course = getCourse(state.courseId);
    if(!course){ goToCourses(); return; }
    var subject = getSubject(course, state.subjectId);
    if(!subject){ goToSubjects(course.id); return; }

    elHeaderTitle.textContent = subject.name;
    elBtnBack.hidden = false;
    elBreadcrumb.hidden = false;
    elBreadcrumb.innerHTML = '<span class="crumb-link" data-goto="course">' + escapeHtml(course.name) + '</span><span class="crumb-sep">&rsaquo;</span><span>' + escapeHtml(subject.name) + '</span>';
    var crumbLink = elBreadcrumb.querySelector('[data-goto="course"]');
    if(crumbLink) crumbLink.addEventListener('click', function(){ goToSubjects(course.id); });

    if(subject.students.length === 0){
      elMain.innerHTML = emptyState('🧑‍🎓', 'No hay estudiantes todavía', 'Tocá el botón "+" para agregar un estudiante.');
      return;
    }

    var cols = subject.numColumns;
    var colHeaders = '';
    for(var i = 0; i < cols; i++){ colHeaders += '<th class="col-grade">N' + (i + 1) + '</th>'; }

    var rows = subject.students.map(function(st){
      var cells = '';
      for(var i = 0; i < cols; i++){
        var g = st.grades[i];
        var hasVal = typeof g === 'number' && !isNaN(g);
        cells += '<td class="cell-grade ' + (hasVal ? 'filled' : 'empty') + '" data-student="' + st.id + '" data-col="' + i + '">' + (hasVal ? formatGrade(g) : '&mdash;') + '</td>';
      }
      var avg = average(st.grades);
      return '<tr>' +
        '<td class="cell-name" data-student="' + st.id + '">' +
          '<div class="cell-name-inner"><span class="student-name">' + escapeHtml(st.name) + '</span><span class="name-menu-hint">&#8942;</span></div>' +
        '</td>' +
        cells +
        '<td class="cell-avg ' + (avg !== null ? gradeClass(avg) : '') + '">' + (avg !== null ? formatGrade(avg) : '&mdash;') + '</td>' +
      '</tr>';
    }).join('');

    elMain.innerHTML =
      '<div class="table-wrap">' +
        '<table class="grades-table">' +
          '<thead><tr>' +
            '<th class="col-name">Estudiante</th>' +
            colHeaders +
            '<th class="col-avg">Promedio</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
      '<button class="fab-add-student" id="btn-add-student-inline">+ Agregar estudiante</button>';

    elMain.querySelector('#btn-add-student-inline').addEventListener('click', handleAddStudent);

    elMain.querySelectorAll('.cell-grade').forEach(function(td){
      td.addEventListener('click', function(){
        var student = subject.students.find(function(s){ return s.id === td.dataset.student; });
        handleGradeCell(subject, student, parseInt(td.dataset.col, 10));
      });
    });
    elMain.querySelectorAll('.cell-name').forEach(function(td){
      td.addEventListener('click', function(){
        var student = subject.students.find(function(s){ return s.id === td.dataset.student; });
        handleStudentMenu(subject, student);
      });
    });
  }

  function emptyState(icon, title, msg){
    return '<div class="empty-state">' +
      '<div class="empty-icon">' + icon + '</div>' +
      '<div class="empty-title">' + escapeHtml(title) + '</div>' +
      '<div class="empty-msg">' + escapeHtml(msg) + '</div>' +
    '</div>';
  }

  /* ---------- Render principal ---------- */
  function render(){
    if(state.view === 'courses') renderCourses();
    else if(state.view === 'subjects') renderSubjects();
    else if(state.view === 'grades') renderGrades();
  }

  /* ---------- Service worker (offline) ---------- */
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(err){
        console.warn('No se pudo registrar el service worker', err);
      });
    });
  }

  render();
})();
