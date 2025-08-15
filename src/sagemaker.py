# file: sagemaker_pipeline_template.py
from sagemaker.workflow.pipeline import Pipeline
from sagemaker.workflow.steps import ProcessingStep, TrainingStep, CreateModelStep, RegisterModel
from sagemaker.processing import ScriptProcessor
from sagemaker.estimator import Estimator
from sagemaker.model import Model
from sagemaker.workflow.parameters import ParameterString, ParameterInteger
from sagemaker.workflow.pipeline_context import PipelineSession
import sagemaker

# Replace with your values
region = "us-west-2"
role = "arn:aws:iam::123456789012:role/SageMakerExecutionRole-<project>"
default_bucket = "your-s3-bucket"
session = PipelineSession()

# Pipeline parameters (example)
processing_instance_count = ParameterInteger(name="ProcessingInstanceCount", default_value=1)
train_instance_type = ParameterString(name="TrainInstanceType", default_value="ml.m5.xlarge")
training_instance_count = ParameterInteger(name="TrainingInstanceCount", default_value=1)

# 1) Processing step (preprocess)
script_processor = ScriptProcessor(
    image_uri="520713654638.dkr.ecr.us-west-2.amazonaws.com/sagemaker-sklearn:latest",
    command=["python3"],
    instance_type="ml.m5.xlarge",
    instance_count=1,
    role=role,
    sagemaker_session=session,
)
processing_step = ProcessingStep(
    name="Preprocessing",
    processor=script_processor,
    inputs=[],
    outputs=[],
    code="scripts/preprocess.py",  # implement this
)

# 2) Training step
estimator = Estimator(
    image_uri="123456789012.dkr.ecr.us-west-2.amazonaws.com/<your-training-image>",
    role=role,
    instance_count=1,
    instance_type="ml.m5.xlarge",
    sagemaker_session=session,
)
training_step = TrainingStep(
    name="TrainModel",
    estimator=estimator,
    inputs={"train": "<s3://.../train>"},
)

# 3) Register model
# Create a Model object pointing to the trained artifact, then register
model = Model(
    image_uri=estimator.image_uri,
    model_data=training_step.properties.ModelArtifacts.S3ModelArtifacts,
    role=role,
    sagemaker_session=session,
)
create_model_step = CreateModelStep(
    name="CreateModelForRegistration",
    model=model,
)
register_step = RegisterModel(
    name="RegisterModel",
    model_package_group_name="<project>-model-group",
    model_package_input=model,  # minimal; you may add approval_status or metadata
)

# 4) Construct pipeline
pipeline = Pipeline(
    name="<project>-pipeline",
    parameters=[processing_instance_count, train_instance_type, training_instance_count],
    steps=[processing_step, training_step, create_model_step, register_step],
    sagemaker_session=session,
)

if __name__ == "__main__":
    pipeline.upsert(role_arn=role)
    execution = pipeline.start()
    print("Started pipeline:", execution.pipeline_execution_arn)
