// SK Furniture - Jenkins pipeline (LOCAL kind cluster, no cloud, no Terraform)
//
// What this does on every build:
//   1. Checkout code from GitHub
//   2. Build backend + frontend Docker images locally
//   3. Load both images straight into the running kind cluster's nodes
//      (kind load docker-image) - no registry/ECR needed
//   4. kubectl apply the k8s/ manifests (creates namespace/secret/mongo the
//      first time, updates them on every later run)
//   5. Force a rollout restart so the pods pick up the freshly-loaded image
//   6. Optionally run the DB seed job
//   7. Smoke test the backend health endpoint
//
// PREREQUISITES (see chat for full setup steps):
//   - A kind cluster named "sk-furniture" already created on this laptop
//     (kind create cluster --name sk-furniture --config infra/kind/kind-config.yaml)
//   - ingress-nginx installed on that cluster
//   - Jenkins agent has: docker CLI, kubectl, kind CLI, and can talk to the
//     laptop's Docker daemon (if Jenkins itself runs in Docker, mount
//     /var/run/docker.sock and pass KUBECONFIG through)
//   - Jenkins agent's kubeconfig context is already set to "kind-sk-furniture"

pipeline {
    agent any

    parameters {
        booleanParam(name: 'RUN_SEED', defaultValue: false,
            description: 'Run the one-time database seed job after deploying (first deploy only)')
    }

    environment {
        CLUSTER_NAME = 'sk-furniture'
        NAMESPACE    = 'sk-furniture'
        BACKEND_IMG  = 'sk-furniture-backend'
        FRONTEND_IMG = 'sk-furniture-frontend'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Set build variables') {
            steps {
                script {
                    env.IMAGE_TAG = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    echo "Building tag ${env.IMAGE_TAG} for local kind cluster ${env.CLUSTER_NAME}"
                }
            }
        }

        stage('Verify kind cluster is up') {
            steps {
                sh '''
                    kubectl config use-context kind-$CLUSTER_NAME
                    kubectl get nodes
                '''
            }
        }

        stage('Build backend image') {
            steps {
                sh '''
                    docker build -t $BACKEND_IMG:$IMAGE_TAG -t $BACKEND_IMG:latest ./backend
                '''
            }
        }

        stage('Build frontend image') {
            steps {
                sh '''
                    docker build -t $FRONTEND_IMG:$IMAGE_TAG -t $FRONTEND_IMG:latest ./frontend
                '''
            }
        }

        stage('Load images into kind') {
            steps {
                sh '''
                    kind load docker-image $BACKEND_IMG:latest  --name $CLUSTER_NAME
                    kind load docker-image $FRONTEND_IMG:latest --name $CLUSTER_NAME
                '''
            }
        }

        stage('Apply k8s manifests') {
            steps {
                sh '''
                    kubectl apply -f k8s/00-namespace.yaml
                    kubectl apply -f k8s/01-secrets.yaml
                    kubectl apply -f k8s/02-mongo.yaml
                    kubectl apply -f k8s/03-backend.yaml
                    kubectl apply -f k8s/05-frontend.yaml
                    kubectl apply -f k8s/06-ingress.yaml
                    kubectl apply -f k8s/07-hpa.yaml
                '''
            }
        }

        stage('Roll out new image') {
            steps {
                sh '''
                    kubectl -n $NAMESPACE rollout restart deployment/backend
                    kubectl -n $NAMESPACE rollout restart deployment/frontend
                    kubectl -n $NAMESPACE rollout status deployment/backend  --timeout=180s
                    kubectl -n $NAMESPACE rollout status deployment/frontend --timeout=180s
                '''
            }
        }

        stage('Seed database (first deploy only)') {
            when { expression { return params.RUN_SEED } }
            steps {
                sh '''
                    kubectl -n $NAMESPACE delete job sk-seed --ignore-not-found
                    kubectl apply -f k8s/04-seed-job.yaml
                    kubectl -n $NAMESPACE wait --for=condition=complete job/sk-seed --timeout=120s
                    kubectl -n $NAMESPACE logs job/sk-seed
                '''
            }
        }

        stage('Smoke test') {
            steps {
                sh '''
                    kubectl -n $NAMESPACE run smoke-test-$BUILD_NUMBER --rm -i --restart=Never \
                        --image=curlimages/curl -- curl -sf http://backend:5000/api/health
                '''
            }
        }
    }

    post {
        success {
            echo "Deployed image tag ${env.IMAGE_TAG} to local kind cluster ${env.CLUSTER_NAME}."
            echo "Visit http://skfurniture.local (after adding it to your hosts file)."
        }
        failure {
            echo "Pipeline failed. Check the stage logs above. You can roll back with:"
            echo "  kubectl -n sk-furniture rollout undo deployment/backend"
            echo "  kubectl -n sk-furniture rollout undo deployment/frontend"
        }
    }
}
